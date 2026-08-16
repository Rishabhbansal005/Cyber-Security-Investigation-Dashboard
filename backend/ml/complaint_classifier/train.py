"""Train TF-IDF + Logistic Regression crime classifier. Writes artifacts under ml/artifacts/."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT.parent) not in sys.path:
    sys.path.insert(0, str(ROOT.parent))

from ml.complaint_classifier.preprocess import clean_text, load_categories  # noqa: E402
from ml.data.generate_complaints import generate_rows  # noqa: E402

ARTIFACT_DIR = ROOT / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "complaint_classifier.joblib"
METRICS_PATH = ARTIFACT_DIR / "complaint_classifier_metrics.json"


def main():
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    csv_train = ROOT / "data" / "complaints_train.csv"
    csv_path = csv_train if csv_train.exists() else ROOT / "data" / "complaints_synthetic.csv"
    if csv_path.exists():
        df = pd.read_csv(csv_path)
    else:
        rows = generate_rows()
        df = pd.DataFrame(rows, columns=["complaint_text", "crime_category"])
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(csv_path, index=False)

    labels = load_categories()
    extra = pd.DataFrame(generate_rows(n_per_class=40), columns=["complaint_text", "crime_category"])
    df = pd.concat([df, extra], ignore_index=True)
    corr = ROOT / "data" / "officer_corrections.csv"
    if corr.exists():
        df = pd.concat([df, pd.read_csv(corr)], ignore_index=True)
    df = df[df["crime_category"].isin(labels)].copy()
    df = df.dropna(subset=["complaint_text", "crime_category"])
    df = df.drop_duplicates(subset=["complaint_text"])
    df["text"] = df["complaint_text"].map(clean_text)

    X_train, X_test, y_train, y_test = train_test_split(
        df["text"], df["crime_category"], test_size=0.2, random_state=42, stratify=df["crime_category"]
    )

    pipe = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=2,
            max_features=12000,
            token_pattern=r"(?u)\b\w+\b",
            stop_words="english",
        )),
        ("clf", LogisticRegression(max_iter=400, class_weight="balanced")),
    ])
    pipe.fit(X_train, y_train)
    pred = pipe.predict(X_test)
    report = classification_report(y_test, pred, output_dict=True, zero_division=0)
    macro_f1 = f1_score(y_test, pred, average="macro")
    cm = confusion_matrix(y_test, pred, labels=labels).tolist()

    joblib.dump({"pipeline": pipe, "labels": labels, "version": "tfidf-lr-v1"}, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps({
        "accuracy": report.get("accuracy"),
        "macro_f1": macro_f1,
        "classification_report": report,
        "confusion_matrix_labels": labels,
        "confusion_matrix": cm,
        "prototype": True,
        "dataset": "synthetic public-style complaints",
    }, indent=2), encoding="utf-8")
    print(f"Saved {MODEL_PATH} accuracy={report.get('accuracy'):.3f} macro_f1={macro_f1:.3f}")


if __name__ == "__main__":
    main()
