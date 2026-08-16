"""Image authenticity assist — screening for cyber-cell triage."""
from __future__ import annotations

import io
import logging
import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image

from app.core.security import CurrentUser, get_current_user_optional
from app.core.supabase_client import get_supabase_admin
from app.services.audit_log import write_officer_audit
from app.services.image_auth_assist import build_flags, case_note, compare_summary, ela_data_url, sha256_bytes

router = APIRouter(prefix="/image-auth", tags=["Image Authenticity"])
logger = logging.getLogger(__name__)

_MAX = 12 * 1024 * 1024
_ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def _safe_db():
    try:
        return get_supabase_admin()
    except Exception as exc:
        logger.warning("supabase unavailable for image-auth: %s", exc)
        return None


def _exif(raw: bytes, filename: str) -> Dict[str, Any]:
    try:
        from app.services.forensics.image_parser import ImageParser
        return ImageParser.parse_stream(io.BytesIO(raw), filename)
    except Exception as exc:
        logger.warning("EXIF parse skipped: %s", exc)
        return {"exif_data": {}, "gps_coordinates": None, "analysis_summary": {"has_exif": False, "has_gps": False}}


def _friendly_exif_rows(exif: Dict[str, Any]) -> list:
    data = exif.get("exif_data") or {}
    labels = {
        "Image Make": "Phone / camera brand",
        "Image Model": "Phone / camera model",
        "EXIF DateTimeOriginal": "Date & time photo was taken",
        "Image DateTime": "Date & time stored in file",
        "EXIF LensModel": "Lens",
        "EXIF Software": "App or software that saved it",
        "Image Software": "App or software that saved it",
        "EXIF ISOSpeedRatings": "ISO (light sensitivity)",
        "EXIF FocalLength": "Focal length",
        "EXIF FNumber": "Aperture",
    }
    rows = []
    for key, label in labels.items():
        val = data.get(key)
        if val:
            rows.append({"label": label, "value": str(val), "present": True})
    gps = exif.get("gps_coordinates")
    if gps:
        rows.insert(0, {
            "label": "Map location (GPS)",
            "value": f"{gps.get('lat'):.6f}, {gps.get('lon'):.6f}",
            "present": True,
        })
    return rows


def _file_facts(raw: bytes, filename: str, digest: str) -> Dict[str, Any]:
    img = Image.open(io.BytesIO(raw))
    fmt = (img.format or os.path.splitext(filename)[1].lstrip(".") or "unknown").upper()
    mode = img.mode
    w, h = img.size
    dpi = img.info.get("dpi")
    software = img.info.get("Software") or img.info.get("software")
    kind = {
        "JPEG": "JPEG — this is what most phones save",
        "JPG": "JPEG — this is what most phones save",
        "PNG": "PNG — computers, AI tools, and screenshots often save this (phones usually do not)",
        "WEBP": "WEBP — common on WhatsApp / websites after compression",
        "BMP": "BMP — uncompressed computer file, uncommon from a phone camera",
    }.get(fmt, fmt)
    facts = [
        {"label": "File name", "value": filename, "plain": "The name of the file you uploaded."},
        {"label": "File type", "value": fmt, "plain": kind},
        {"label": "Picture size", "value": f"{w} × {h} pixels", "plain": "How wide and tall the picture is."},
        {"label": "File weight", "value": f"{len(raw) / 1024:.0f} KB ({len(raw) / (1024 * 1024):.2f} MB)", "plain": "How much space the file takes."},
        {"label": "Colour format", "value": mode, "plain": "RGB = normal colour. RGBA = can have transparent background."},
        {
            "label": "Software tag",
            "value": str(software) if software else "Not stored",
            "plain": "Sometimes the program that saved the file writes its name here.",
        },
        {
            "label": "Fingerprint (SHA-256)",
            "value": digest,
            "plain": "Unique ID of this exact file. If one pixel changes, this ID changes.",
        },
    ]
    return {"format": fmt, "mode": mode, "width": w, "height": h, "rows": facts}


def _read_upload(upload: UploadFile) -> tuple[str, str, bytes]:
    name = upload.filename or "upload.jpg"
    ext = os.path.splitext(name)[1].lower()
    if ext not in _ALLOWED:
        raise HTTPException(status_code=400, detail="Upload JPG, PNG, WEBP, or BMP.")
    raw = upload.file.read()
    if hasattr(raw, "__await__"):
        raise HTTPException(status_code=400, detail="Invalid upload.")
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(raw) > _MAX:
        raise HTTPException(status_code=400, detail="Image is larger than 12 MB.")
    return name, ext, raw


async def _read_upload_async(upload: UploadFile) -> tuple[str, str, bytes]:
    name = upload.filename or "upload.jpg"
    ext = os.path.splitext(name)[1].lower()
    if ext not in _ALLOWED:
        raise HTTPException(status_code=400, detail="Upload JPG, PNG, WEBP, or BMP.")
    raw = await upload.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(raw) > _MAX:
        raise HTTPException(status_code=400, detail="Image is larger than 12 MB.")
    return name, ext, raw


def _enrich(raw: bytes, name: str, ext: str, result: Dict[str, Any], role: str = "exhibit", rgb: Image.Image | None = None) -> Dict[str, Any]:
    digest = sha256_bytes(raw)
    result["exif"] = _exif(raw, name)

    result["sha256"] = digest
    result["bytes"] = len(raw)
    result["file_facts"] = _file_facts(raw, name, digest)
    has_exif = bool((result.get("exif") or {}).get("analysis_summary", {}).get("has_exif"))
    has_gps = bool((result.get("exif") or {}).get("analysis_summary", {}).get("has_gps"))
    camera_rows = _friendly_exif_rows(result.get("exif") or {})
    if not has_exif:
        camera_rows = [
            {"label": "Phone / camera brand", "value": "Not found in this file", "present": False},
            {"label": "Phone / camera model", "value": "Not found in this file", "present": False},
            {"label": "Date & time photo was taken", "value": "Not found in this file", "present": False},
            {"label": "Map location (GPS)", "value": "Not found in this file", "present": False},
        ]
    elif not has_gps:
        camera_rows.append({"label": "Map location (GPS)", "value": "Not found in this file", "present": False})
    result["camera_diary"] = {
        "has_exif": has_exif,
        "has_gps": has_gps,
        "rows": camera_rows,
        "plain": (
            "A real phone photo often stores a hidden diary: which phone, when it was clicked, sometimes where. "
            "This file has none of that. Normal for AI pictures, screenshots, and WhatsApp forwards. "
            "It does not prove fake or real by itself."
            if not has_exif else
            "This file still has a camera diary (phone/time). Check it against the complainant's story."
        ),
    }
    try:
        result["ela_png"] = ela_data_url(raw, img=rgb)
    except Exception as exc:
        logger.warning("ELA skipped: %s", exc)
        result["ela_png"] = None
    result["flags"] = build_flags(result)
    result["case_note"] = case_note(result, role=role)
    notes = list(result.get("officer_notes") or [])
    if not has_exif:
        notes.append("No camera diary. Common for AI PNG, screenshot, or WhatsApp — not proof either way.")
    result["officer_notes"] = notes
    return result


def _run_model(raw: bytes, name: str) -> tuple[Dict[str, Any], Image.Image]:
    from ml.image_auth.predict import analyze_pil
    from ml.image_auth_ai.predict import analyze_ai_pil, model_available, unavailable_payload

    rgb = Image.open(io.BytesIO(raw)).convert("RGB")
    orig_w, orig_h = rgb.size
    if max(orig_w, orig_h) > 1280:
        rgb = rgb.copy()
        rgb.thumbnail((1280, 1280), Image.Resampling.BILINEAR)
    result = analyze_pil(rgb, name)
    result["image_size"] = {"width": orig_w, "height": orig_h}
    if model_available():
        try:
            result["ai_screen"] = analyze_ai_pil(rgb, name)
        except Exception as exc:
            logger.warning("AI vs real inference skipped: %s", exc)
            result["ai_screen"] = unavailable_payload()
            result["ai_screen"]["error"] = str(exc)
    else:
        result["ai_screen"] = unavailable_payload()
    return result, rgb


@router.post("/analyze")
async def analyze_image_auth(
    current_user: CurrentUser = Depends(get_current_user_optional),
    file: UploadFile = File(...),
):
    name, ext, raw = await _read_upload_async(file)
    try:
        scored, rgb = _run_model(raw, name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("image authenticity inference failed")
        raise HTTPException(status_code=500, detail=f"Could not analyse this image: {exc}") from exc

    result = _enrich(raw, name, ext, scored, role="exhibit", rgb=rgb)
    db = _safe_db()
    if db is not None:
        write_officer_audit(
            db,
            action="IMAGE_AUTH_ANALYZE",
            target=name,
            officer_id=current_user.id,
            officer_email=current_user.email,
            metadata={"sha256": result.get("sha256"), "concern_level": result.get("concern_level")},
        )
    return result


@router.post("/compare")
async def compare_image_auth(
    current_user: CurrentUser = Depends(get_current_user_optional),
    victim: UploadFile = File(..., description="Complainant's original photo"),
    disputed: UploadFile = File(..., description="Photo being misused"),
):
    v_name, v_ext, v_raw = await _read_upload_async(victim)
    d_name, d_ext, d_raw = await _read_upload_async(disputed)
    try:
        v_scored, v_rgb = _run_model(v_raw, v_name)
        d_scored, d_rgb = _run_model(d_raw, d_name)
        v_res = _enrich(v_raw, v_name, v_ext, v_scored, role="victim", rgb=v_rgb)
        d_res = _enrich(d_raw, d_name, d_ext, d_scored, role="disputed", rgb=d_rgb)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("image authenticity compare failed")
        raise HTTPException(status_code=500, detail=f"Could not compare images: {exc}") from exc

    comparison = compare_summary(v_res, d_res)
    db = _safe_db()
    if db is not None:
        write_officer_audit(
            db,
            action="IMAGE_AUTH_COMPARE",
            target=f"{v_name} vs {d_name}",
            officer_id=current_user.id,
            officer_email=current_user.email,
            metadata={
                "victim_sha256": v_res.get("sha256"),
                "disputed_sha256": d_res.get("sha256"),
                "same_file": comparison.get("same_file"),
            },
        )
    return {"victim": v_res, "disputed": d_res, "comparison": comparison}
