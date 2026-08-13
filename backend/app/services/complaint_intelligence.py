"""Persist and load complaint ML outputs in Supabase."""
from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


def persist_analysis(db, result: dict[str, Any]) -> bool:
    case_id = result["case_id"]
    clf = result["classification"]
    prio = result["priority"]
    try:
        row = {
            "case_id": case_id,
            "predicted_category": clf.get("predicted_category"),
            "category_scores": clf.get("probabilities") or {},
            "category_confidence": clf.get("confidence"),
            "priority_score": prio.get("priority_score"),
            "priority_label": prio.get("priority_label"),
            "explanation": prio.get("reasons") or [],
            "features_used": prio.get("features_used") or [],
            "model_versions": {
                "classifier": clf.get("model_version"),
                "priority": prio.get("model_version"),
                "embedding": result.get("embedding_version"),
            },
            "is_prototype": True,
            "disclaimer": result.get("disclaimer"),
        }
        db.table("complaint_analysis").upsert(row, on_conflict="case_id").execute()
        db.table("extracted_entities").delete().eq("case_id", case_id).execute()
        entities = result.get("entities") or []
        if entities:
            payload = []
            for e in entities:
                extra = {}
                if e.get("amount_inr") is not None:
                    extra["amount_inr"] = e["amount_inr"]
                payload.append({
                    "case_id": case_id,
                    "entity_type": e.get("type"),
                    "value_raw": e.get("value_raw"),
                    "value_masked": e.get("value_masked"),
                    "normalized": e.get("normalized"),
                    "extra": extra,
                })
            db.table("extracted_entities").insert(payload).execute()
        db.table("case_embeddings").upsert({
            "case_id": case_id,
            "embedding": result.get("embedding") or [],
            "embedding_version": result.get("embedding_version") or "tfidf-cosine-v1",
        }, on_conflict="case_id").execute()
        return True
    except Exception as exc:
        logger.warning("complaint intelligence persist skipped: %s", exc)
        return False


def get_analysis(db, case_id: str) -> Optional[dict]:
    try:
        res = db.table("complaint_analysis").select("*").eq("case_id", case_id).limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as exc:
        logger.warning("complaint_analysis read failed: %s", exc)
        return None


def get_entities(db, case_id: str) -> list[dict]:
    try:
        res = db.table("extracted_entities").select("*").eq("case_id", case_id).execute()
        return res.data or []
    except Exception as exc:
        logger.warning("extracted_entities read failed: %s", exc)
        return []


def get_stored_similar(db, case_id: str, k: int = 5) -> list[dict]:
    try:
        own = db.table("case_embeddings").select("*").eq("case_id", case_id).limit(1).execute()
        if not own.data:
            return []
        version = own.data[0].get("embedding_version")
        qvec = own.data[0].get("embedding") or []
        others = db.table("case_embeddings").select("case_id, embedding").eq("embedding_version", version).execute()
        rows = [r for r in (others.data or []) if r.get("case_id") != case_id]
        if not rows or not qvec:
            return []
        import numpy as np

        ids = [r["case_id"] for r in rows]
        matrix = np.array([r.get("embedding") or [] for r in rows], dtype=float)
        if matrix.ndim != 2 or matrix.shape[1] != len(qvec):
            return []
        q = np.array(qvec, dtype=float)
        denom = (np.linalg.norm(matrix, axis=1) * (np.linalg.norm(q) + 1e-9)) + 1e-9
        sims = matrix @ q / denom
        order = np.argsort(-sims)[:k]
        case_ids = [ids[i] for i in order]
        meta = db.table("cases").select("id, case_number, title").in_("id", case_ids).execute()
        by_id = {c["id"]: c for c in (meta.data or [])}
        out = []
        for i in order:
            m = by_id.get(ids[i], {})
            out.append({
                "case_id": ids[i],
                "case_number": m.get("case_number"),
                "title": m.get("title"),
                "similarity": round(float(sims[i]), 4),
                "label": "Potentially related",
            })
        return out
    except Exception as exc:
        logger.warning("similar cases lookup failed: %s", exc)
        return []


def ml_stats(db) -> dict[str, Any]:
    empty = {
        "analyzed_count": 0,
        "high_priority_ai": 0,
        "potentially_linked": 0,
        "crime_type_mix": [],
        "by_case": {},
        "disclaimer": (
            "Prototype trained on public/synthetic complaint text. "
            "Scores are model confidence, not legal certainty."
        ),
        "tables_ready": False,
    }
    try:
        analysis = db.table("complaint_analysis").select(
            "case_id, predicted_category, priority_label, priority_score, category_confidence"
        ).execute()
        rows = analysis.data or []
        high = sum(1 for r in rows if str(r.get("priority_label") or "").upper() == "HIGH")
        mix: dict[str, int] = {}
        by_case = {}
        for r in rows:
            cat = r.get("predicted_category") or "Other"
            mix[cat] = mix.get(cat, 0) + 1
            by_case[r["case_id"]] = {
                "predicted_category": cat,
                "priority_label": r.get("priority_label"),
                "priority_score": r.get("priority_score"),
            }
        linked = 0
        try:
            emb = db.table("case_embeddings").select("id", count="exact").execute()
            linked = max(0, (emb.count or 0) - 1) if (emb.count or 0) > 1 else 0
        except Exception:
            pass
        # Count pairs with stored similar is expensive; use analyzed cases with HIGH similar later.
        # Approximate: cases that have at least one embedding besides themselves.
        return {
            "analyzed_count": len(rows),
            "high_priority_ai": high,
            "potentially_linked": linked,
            "crime_type_mix": [{"category": k, "count": v} for k, v in sorted(mix.items(), key=lambda x: -x[1])],
            "by_case": by_case,
            "disclaimer": empty["disclaimer"],
            "tables_ready": True,
        }
    except Exception as exc:
        logger.warning("ml-stats skipped: %s", exc)
        return empty
