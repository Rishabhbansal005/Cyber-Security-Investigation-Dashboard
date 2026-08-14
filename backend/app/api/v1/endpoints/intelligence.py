"""Complaint investigation intelligence APIs (separate from OSINT IOC ML)."""
from __future__ import annotations

import csv
import io
import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.security import CurrentUser, get_current_user, get_current_user_optional
from app.core.supabase_client import get_supabase_admin
from app.services.audit_log import write_officer_audit
from app.services.complaint_intelligence import (
    get_analysis,
    get_entities,
    get_stored_similar,
    ml_stats,
    persist_analysis,
)

router = APIRouter(tags=["Intelligence"])
logger = logging.getLogger(__name__)

_MAX_FILE = 8 * 1024 * 1024
_MAX_ROWS = 15


class AnalyzeComplaintBody(BaseModel):
    case_id: str


class AnalyzeTextBody(BaseModel):
    text: str
    case_id: Optional[str] = None
    title: Optional[str] = None


def _not_trained(exc: FileNotFoundError) -> HTTPException:
    return HTTPException(status_code=503, detail=str(exc) or "model not trained")


def _text_from_pdf(raw: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise HTTPException(
            status_code=400,
            detail="PDF support is not installed on the server. Paste the text, or install pypdf.",
        ) from exc
    reader = PdfReader(io.BytesIO(raw))
    pages = []
    for page in reader.pages[:20]:
        pages.append(page.extract_text() or "")
    text = "\n".join(pages).strip()
    if len(text) < 8:
        raise HTTPException(
            status_code=400,
            detail="No readable text in this PDF (it may be a scanned image). Copy the text and paste it instead.",
        )
    return text[:20000]


def _texts_from_file(filename: str, raw: bytes) -> list[str]:
    name = (filename or "complaint.txt").lower()
    if name.endswith(".pdf"):
        return [_text_from_pdf(raw)]
    if name.endswith((".xlsx", ".xls", ".doc", ".docx", ".png", ".jpg", ".jpeg")):
        raise HTTPException(
            status_code=400,
            detail="Use .txt, .csv, .json, or .pdf. Word/Excel/images are not read automatically — paste the text instead.",
        )
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        content = raw.decode("latin-1", errors="replace")
    content = content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="File is empty.")

    if name.endswith(".json"):
        data = json.loads(content)
        if isinstance(data, dict):
            blob = data.get("complaint_text") or data.get("description") or data.get("text") or json.dumps(data)
            return [str(blob)]
        if isinstance(data, list):
            out = []
            for row in data[:_MAX_ROWS]:
                if isinstance(row, dict):
                    out.append(str(row.get("complaint_text") or row.get("description") or row.get("text") or row))
                else:
                    out.append(str(row))
            return [t for t in out if t.strip()]
        return [str(data)]

    if name.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(content))
        fieldnames = [f.lower() for f in (reader.fieldnames or [])]
        texts = []
        if fieldnames:
            for i, row in enumerate(reader):
                if i >= _MAX_ROWS:
                    break
                lower = {k.lower(): (v or "") for k, v in row.items() if k}
                blob = " ".join(filter(None, [
                    lower.get("title"),
                    lower.get("complaint_text") or lower.get("description") or lower.get("text") or lower.get("complaint"),
                ]))
                if blob.strip():
                    texts.append(blob.strip())
            if texts:
                return texts
        plain = csv.reader(io.StringIO(content))
        texts = []
        for i, row in enumerate(plain):
            if i >= _MAX_ROWS:
                break
            line = " ".join(row).strip()
            if line:
                texts.append(line)
        return texts

    return [content]


def _safe_db():
    try:
        return get_supabase_admin()
    except Exception as exc:
        logger.warning("supabase unavailable for analysis: %s", exc)
        return None


def _run_one(db, *, title: str, description: str, case_id: Optional[str], persist: bool):
    from ml.pipeline import analyze_complaint as run_pipeline

    other_cases: list = []
    evidence_count = 0
    incident_date = None
    cid = case_id or "upload"
    if db is not None:
        try:
            q = db.table("cases").select("id, title, description, case_number")
            if case_id:
                q = q.neq("id", case_id)
            other_cases = (q.limit(200).execute().data or [])
            if case_id:
                ev = db.table("evidence").select("id", count="exact").eq("case_id", case_id).execute()
                evidence_count = ev.count or 0
                case_res = db.table("cases").select("incident_date").eq("id", case_id).limit(1).execute()
                if case_res.data:
                    incident_date = case_res.data[0].get("incident_date")
        except Exception as exc:
            logger.warning("similar-case lookup skipped: %s", exc)

    result = run_pipeline(
        case_id=cid,
        title=title,
        description=description,
        incident_date=incident_date,
        evidence_count=evidence_count,
        other_cases=other_cases,
    )
    result.pop("embedding", None)
    if persist and case_id and db is not None:
        result["persisted"] = persist_analysis(db, result)
    else:
        result["persisted"] = False
    return result


def _pack_items(items: list, source_name: str) -> dict:
    return {
        "source": source_name,
        "count": len(items),
        "items": items,
        "training_note": (
            "Trained on merged public/Kaggle-style complaint text plus Indian scam messages. "
            "Scores are investigation leads, not legal certainty."
        ),
        "disclaimer": items[0].get("disclaimer") if items else None,
    }


@router.post("/analyze/complaint")
async def analyze_complaint(
    body: AnalyzeComplaintBody,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase_admin()
    case_res = db.table("cases").select(
        "id, title, description, incident_date, case_number"
    ).eq("id", body.case_id).limit(1).execute()
    if not case_res.data:
        raise HTTPException(status_code=404, detail="Case not found")
    case = case_res.data[0]
    try:
        result = _run_one(
            db,
            title=case.get("title") or "",
            description=case.get("description") or "",
            case_id=case["id"],
            persist=True,
        )
    except FileNotFoundError as exc:
        raise _not_trained(exc)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("analyze complaint failed")
        raise HTTPException(status_code=500, detail=str(exc))

    write_officer_audit(
        db,
        action="ANALYZE_COMPLAINT",
        target=case.get("case_number") or body.case_id,
        officer_id=current_user.id,
        officer_email=current_user.email,
        metadata={
            "case_id": body.case_id,
            "predicted_category": result.get("classification", {}).get("predicted_category"),
            "priority_label": result.get("priority", {}).get("priority_label"),
        },
    )
    return result


@router.post("/analyze/text")
async def analyze_complaint_text(
    body: AnalyzeTextBody,
    current_user: CurrentUser = Depends(get_current_user_optional),
):
    blob = (body.text or "").strip()
    if len(blob) < 8:
        raise HTTPException(status_code=400, detail="Paste a longer complaint (at least a few words).")
    db = _safe_db()
    try:
        item = _run_one(
            db,
            title=body.title or "pasted-text",
            description=blob,
            case_id=body.case_id or None,
            persist=bool(body.case_id),
        )
    except FileNotFoundError as exc:
        raise _not_trained(exc)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("analyze text failed")
        raise HTTPException(status_code=500, detail=str(exc))
    if db is not None:
        write_officer_audit(
            db,
            action="ANALYZE_COMPLAINT",
            target="pasted-text",
            officer_id=current_user.id,
            officer_email=current_user.email,
            metadata={"case_id": body.case_id},
        )
    return _pack_items([item], "pasted-text")


@router.post("/analyze/complaint-file")
async def analyze_complaint_file(
    current_user: CurrentUser = Depends(get_current_user_optional),
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    case_id: Optional[str] = Form(None),
):
    db = _safe_db()
    blobs: list[str] = []
    source_name = "pasted-text"
    if file is not None and file.filename:
        raw = await file.read()
        if raw:
            if len(raw) > _MAX_FILE:
                raise HTTPException(status_code=400, detail="File too large (max 8 MB).")
            source_name = file.filename or "upload"
            blobs = _texts_from_file(source_name, raw)
    if text and text.strip():
        blobs = [text.strip()] + blobs
    if not blobs:
        raise HTTPException(status_code=400, detail="Upload a .txt/.csv/.json file or paste complaint text.")

    persist = bool(case_id)
    items = []
    try:
        for blob in blobs[:_MAX_ROWS]:
            items.append(
                _run_one(
                    db,
                    title=source_name,
                    description=blob,
                    case_id=case_id,
                    persist=persist and len(blobs) == 1,
                )
            )
    except FileNotFoundError as exc:
        raise _not_trained(exc)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("analyze complaint file failed")
        raise HTTPException(status_code=500, detail=str(exc))

    if db is not None:
        write_officer_audit(
            db,
            action="ANALYZE_COMPLAINT",
            target=source_name,
            officer_id=current_user.id,
            officer_email=current_user.email,
            metadata={"source": source_name, "rows": len(items), "case_id": case_id},
        )
    return _pack_items(items, source_name)


@router.get("/cases/{case_id}/analysis")
async def case_analysis(
    case_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase_admin()
    row = get_analysis(db, case_id)
    if not row:
        raise HTTPException(status_code=404, detail="No analysis yet. Run Analyze complaint.")
    return row


@router.get("/cases/{case_id}/similar")
async def case_similar(
    case_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase_admin()
    return {"items": get_stored_similar(db, case_id), "label": "Potentially related"}


@router.get("/cases/{case_id}/entities")
async def case_entities(
    case_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase_admin()
    items = get_entities(db, case_id)
    return {"items": items}


class OfficerFeedbackBody(BaseModel):
    complaint_text: str
    predicted_category: Optional[str] = None
    correct_category: str
    agreed: bool = False


@router.post("/analyze/feedback")
async def officer_feedback(
    body: OfficerFeedbackBody,
    current_user: CurrentUser = Depends(get_current_user_optional),
):
    from ml.complaint_classifier.preprocess import load_categories

    labels = load_categories()
    if body.correct_category not in labels:
        raise HTTPException(status_code=400, detail="Unknown category.")
    path = Path(__file__).resolve().parents[4] / "ml" / "data" / "officer_corrections.csv"
    # backend/app/api/v1/endpoints/intelligence.py -> parents[4] is backend?
    # file: backend/app/api/v1/endpoints/intelligence.py
    # parent0 endpoints, 1 v1, 2 api, 3 app, 4 backend. Yes backend/ml/data
    path.parent.mkdir(parents=True, exist_ok=True)
    new = not path.exists()
    with path.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["complaint_text", "crime_category"])
        if not body.agreed:
            w.writerow([body.complaint_text.strip(), body.correct_category])
        else:
            w.writerow([body.complaint_text.strip(), body.correct_category])
    db = _safe_db()
    if db is not None:
        write_officer_audit(
            db,
            action="ANALYZE_FEEDBACK",
            target=body.correct_category,
            officer_id=current_user.id,
            officer_email=current_user.email,
            metadata={"agreed": body.agreed, "predicted": body.predicted_category},
        )
    return {"ok": True, "saved": True, "note": "Correction saved. Retrain later: python -m ml.complaint_classifier.train"}


@router.get("/dashboard/ml-stats")
async def dashboard_ml_stats(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
):
    db = get_supabase_admin()
    return ml_stats(db)
