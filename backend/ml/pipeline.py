"""Complaint intelligence pipeline: extract → classify → similar → priority."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from ml.complaint_classifier.predict import predict_category
from ml.entities.extract import extract_entities, max_amount_inr
from ml.priority_model.predict import predict_priority
from ml.similarity.embeddings import cosine_top_k, embed_texts


def hours_since(iso_ts: Optional[str]) -> float:
    if not iso_ts:
        return 72.0
    try:
        dt = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return max(0.0, (datetime.now(timezone.utc) - dt).total_seconds() / 3600.0)
    except Exception:
        return 72.0


def analyze_complaint(
    *,
    case_id: str,
    title: str,
    description: str,
    incident_date: Optional[str],
    evidence_count: int,
    other_cases: list[dict[str, Any]],
) -> dict[str, Any]:
    raw = f"{title or ''}\n{description or ''}".strip()
    if len(raw) < 8:
        raise ValueError("Complaint text is too short to analyze.")

    entities = extract_entities(raw)
    classification = predict_category(raw)

    corpus = [raw] + [f"{c.get('title') or ''} {c.get('description') or ''}" for c in other_cases]
    ids = [case_id] + [c["id"] for c in other_cases]
    matrix, embed_version = embed_texts(corpus)
    similar = cosine_top_k(matrix[0], matrix, ids, k=5, exclude_id=case_id)
    # attach case_number/title
    by_id = {c["id"]: c for c in other_cases}
    for item in similar:
        meta = by_id.get(item["case_id"], {})
        item["case_number"] = meta.get("case_number")
        item["title"] = meta.get("title")

    feats = {
        "amount_inr": max_amount_inr(entities),
        "hours_since_incident": hours_since(incident_date),
        "entity_count": len(entities),
        "has_upi": any(e["type"] == "upi" for e in entities),
        "has_url": any(e["type"] == "url" for e in entities),
        "has_phone": any(e["type"] == "phone" for e in entities),
        "similar_count": len([s for s in similar if s["similarity"] >= 0.45]),
        "classifier_confidence": classification["confidence"],
        "evidence_count": evidence_count,
    }
    priority = predict_priority(feats)

    return {
        "case_id": case_id,
        "complaint_text": raw,
        "classification": classification,
        "entities": entities,
        "similar_cases": similar,
        "priority": priority,
        "embedding": matrix[0].tolist(),
        "embedding_version": embed_version,
        "is_prototype": True,
        "disclaimer": (
            "Prototype trained on public/synthetic complaint text. "
            "Scores are model confidence and investigation leads, not legal certainty. "
            "Final decisions remain with the authorized officer."
        ),
    }
