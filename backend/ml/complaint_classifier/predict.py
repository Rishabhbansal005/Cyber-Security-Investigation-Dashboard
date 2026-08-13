"""Load trained classifier. Raises FileNotFoundError if not trained."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib

from ml.complaint_classifier.preprocess import clean_text, load_categories

_MODEL = None
_PATH = Path(__file__).resolve().parents[1] / "artifacts" / "complaint_classifier.joblib"


def model_path() -> Path:
    return _PATH


def load_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    if not _PATH.exists():
        raise FileNotFoundError(
            "Complaint classifier is not trained. Run: python -m ml.complaint_classifier.train"
        )
    _MODEL = joblib.load(_PATH)
    return _MODEL


def predict_category(text: str) -> dict[str, Any]:
    bundle = load_model()
    pipe = bundle["pipeline"]
    labels = bundle.get("labels") or load_categories()
    cleaned = clean_text(text)
    if not cleaned:
        raise ValueError("Complaint text is empty.")
    proba = pipe.predict_proba([cleaned])[0]
    class_labels = list(pipe.classes_)
    scores = {str(cls): float(p) for cls, p in zip(class_labels, proba)}
    ordered = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_label, top_score = ordered[0]
    # Feature-ish tokens from TF-IDF for honest explanation (highest weights for predicted class)
    indicators = _top_indicators(pipe, cleaned, top_label)
    return {
        "predicted_category": top_label,
        "confidence": top_score,
        "probabilities": {k: round(v, 4) for k, v in ordered},
        "indicators": indicators,
        "model_version": bundle.get("version", "tfidf-lr-v1"),
        "is_prototype": True,
        "disclaimer": "Model prediction/confidence only. Not legal certainty.",
        "available_categories": labels,
    }


def _top_indicators(pipe, cleaned: str, predicted: str, k: int = 6) -> list[str]:
    try:
        vec = pipe.named_steps["tfidf"]
        clf = pipe.named_steps["clf"]
        X = vec.transform([cleaned])
        feature_names = vec.get_feature_names_out()
        class_idx = list(clf.classes_).index(predicted)
        weights = clf.coef_[class_idx]
        present = X.nonzero()[1]
        scored = [(feature_names[i], float(weights[i] * X[0, i])) for i in present]
        scored.sort(key=lambda t: t[1], reverse=True)
        return [name for name, score in scored[:k] if score > 0]
    except Exception:
        return []
