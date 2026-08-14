"""Train XGBoost on synthetic feature rows labelled by documented prototype_score."""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT.parent) not in sys.path:
    sys.path.insert(0, str(ROOT.parent))

from ml.priority_model.predict import (  # noqa: E402
    ARTIFACT_DIR,
    FEATURE_NAMES,
    METRICS_PATH,
    MODEL_PATH,
    feature_vector,
    label_from_score,
    prototype_score,
)


def _synth_row(rng: random.Random) -> dict:
    return {
        "amount_inr": rng.choice([0, 1500, 8000, 20000, 50000, 90000, 200000]),
        "hours_since_incident": rng.choice([2, 8, 20, 48, 120, 400]),
        "entity_count": rng.randint(0, 8),
        "has_upi": rng.random() < 0.45,
        "has_url": rng.random() < 0.35,
        "has_phone": rng.random() < 0.5,
        "similar_count": rng.randint(0, 12),
        "classifier_confidence": round(rng.uniform(0.35, 0.99), 2),
        "evidence_count": rng.randint(0, 5),
    }


def main():
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    rng = random.Random(7)
    rows = [_synth_row(rng) for _ in range(1200)]
    X = np.vstack([feature_vector(r) for r in rows])
    y = np.array([label_from_score(prototype_score(r)) for r in rows])
    mapping = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
    y_num = np.array([mapping[v] for v in y])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_num, test_size=0.2, random_state=42, stratify=y_num
    )
    clf = XGBClassifier(
        n_estimators=80,
        max_depth=4,
        learning_rate=0.12,
        objective="multi:softprob",
        num_class=3,
        eval_metric="mlogloss",
        n_jobs=2,
    )
    clf.fit(X_train, y_train)
    pred = clf.predict(X_test)
    inv = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}
    y_true = [inv[i] for i in y_test]
    y_pred = [inv[i] for i in pred]
    report = classification_report(y_true, y_pred, output_dict=True, zero_division=0)
    joblib.dump({
        "model": clf,
        "classes": ["LOW", "MEDIUM", "HIGH"],
        "feature_names": FEATURE_NAMES,
        "version": "xgb-priority-v1",
    }, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps({
        "macro_f1": f1_score(y_true, y_pred, average="macro"),
        "classification_report": report,
        "prototype": True,
        "label_source": "Documented weighted rules in ml.priority_model.predict.prototype_score",
    }, indent=2), encoding="utf-8")
    print(f"Saved {MODEL_PATH} macro_f1={f1_score(y_true, y_pred, average='macro'):.3f}")


if __name__ == "__main__":
    main()
