"""Prototype XGBoost priority model.

Labels are generated from a documented weighted rule — they are NOT police
decisions. The UI must show contributing features, not implied guilt.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from xgboost import XGBClassifier

FEATURE_NAMES = [
    "amount_inr",
    "log_amount",
    "hours_since_incident",
    "entity_count",
    "has_upi",
    "has_url",
    "has_phone",
    "similar_count",
    "classifier_confidence",
    "evidence_count",
]

ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "priority_model.joblib"
METRICS_PATH = ARTIFACT_DIR / "priority_model_metrics.json"

# Documented prototype labeling weights (not operational policy).
_RULE = {
    "amount": 25,
    "recency": 15,
    "entities": 10,
    "upi": 15,
    "url": 10,
    "similar": 15,
    "confidence": 5,
    "evidence": 5,
}


def feature_vector(feats: dict[str, Any]) -> np.ndarray:
    amount = float(feats.get("amount_inr") or 0)
    hours = float(feats.get("hours_since_incident") or 72)
    return np.array([[
        amount,
        np.log1p(amount),
        hours,
        float(feats.get("entity_count") or 0),
        1.0 if feats.get("has_upi") else 0.0,
        1.0 if feats.get("has_url") else 0.0,
        1.0 if feats.get("has_phone") else 0.0,
        float(feats.get("similar_count") or 0),
        float(feats.get("classifier_confidence") or 0),
        float(feats.get("evidence_count") or 0),
    ]], dtype=float)


def prototype_score(feats: dict[str, Any]) -> int:
    """0-100 heuristic used only to create training labels."""
    amount = float(feats.get("amount_inr") or 0)
    hours = float(feats.get("hours_since_incident") or 168)
    s = 0.0
    s += min(amount / 80000, 1.0) * _RULE["amount"]
    s += max(0.0, 1.0 - hours / 72.0) * _RULE["recency"]
    s += min(float(feats.get("entity_count") or 0) / 6.0, 1.0) * _RULE["entities"]
    if feats.get("has_upi"):
        s += _RULE["upi"]
    if feats.get("has_url"):
        s += _RULE["url"]
    s += min(float(feats.get("similar_count") or 0) / 8.0, 1.0) * _RULE["similar"]
    s += float(feats.get("classifier_confidence") or 0) * _RULE["confidence"]
    s += min(float(feats.get("evidence_count") or 0) / 3.0, 1.0) * _RULE["evidence"]
    return int(round(min(100, max(0, s))))


def label_from_score(score: int) -> str:
    if score >= 75:
        return "HIGH"
    if score >= 45:
        return "MEDIUM"
    return "LOW"


def explanation(feats: dict[str, Any]) -> list[str]:
    reasons = []
    amount = float(feats.get("amount_inr") or 0)
    if amount >= 25000:
        reasons.append(f"High reported amount (₹{amount:,.0f})")
    hours = float(feats.get("hours_since_incident") or 999)
    if hours <= 24:
        reasons.append("Recent incident (within 24 hours)")
    if int(feats.get("similar_count") or 0) >= 2:
        reasons.append(f"{int(feats['similar_count'])} potentially similar complaints")
    if feats.get("has_upi"):
        reasons.append("UPI identifier present in complaint text")
    if feats.get("has_url"):
        reasons.append("URL present — review as a digital lead")
    if feats.get("has_phone"):
        reasons.append("Phone number extracted from complaint")
    if int(feats.get("entity_count") or 0) >= 3:
        reasons.append("Multiple identifiers extracted")
    if int(feats.get("evidence_count") or 0) >= 1:
        reasons.append("Evidence already attached to the FIR")
    conf = float(feats.get("classifier_confidence") or 0)
    if conf >= 0.8:
        reasons.append("High classifier confidence on crime type")
    if not reasons:
        reasons.append("Limited structured indicators; officer review still required")
    return reasons


_MODEL = None


def load_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            "Priority model is not trained. Run: python -m ml.priority_model.train"
        )
    _MODEL = joblib.load(MODEL_PATH)
    return _MODEL


def predict_priority(feats: dict[str, Any]) -> dict[str, Any]:
    bundle = load_model()
    model: XGBClassifier = bundle["model"]
    X = feature_vector(feats)
    proba = model.predict_proba(X)[0]
    classes = list(bundle["classes"])
    idx = int(np.argmax(proba))
    label = str(classes[idx])
    # Display score follows documented prototype features so "why this priority" matches the number.
    display = prototype_score(feats)
    return {
        "priority_label": label_from_score(display),
        "priority_score": display,
        "model_class": label,
        "class_probabilities": {str(c): round(float(p), 4) for c, p in zip(classes, proba)},
        "reasons": explanation(feats),
        "features_used": FEATURE_NAMES,
        "labeling_note": "Prototype labels from documented weighted rules, not police decisions.",
        "model_version": bundle.get("version", "xgb-priority-v1"),
        "is_prototype": True,
    }
