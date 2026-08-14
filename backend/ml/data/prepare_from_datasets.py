"""Merge DataSets/ files into complaint_text + crime_category for training."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT.parent) not in sys.path:
    sys.path.insert(0, str(ROOT.parent))

from ml.complaint_classifier.preprocess import load_categories  # noqa: E402

DATASETS = Path(__file__).resolve().parents[3] / "DataSets"
OUT = ROOT / "data" / "complaints_train.csv"
MAX_PER_CLASS = 6000

SUB_MAP = {
    "upi/payment fraud": "UPI Fraud",
    "phishing/fake websites": "Phishing",
    "credit card fraud": "Financial Fraud",
    "investment/loan scams": "Investment Scam",
    "cryptocurrency scams": "Investment Scam",
    "fake job offers": "Job/Employment Scam",
    "education/course scams": "Job/Employment Scam",
    "fake shopping websites": "Online Shopping Scam",
    "non-delivery of goods": "Online Shopping Scam",
    "account takeover": "Account Takeover",
    "email/social media hacking": "Account Takeover",
    "identity theft": "Identity Theft",
    "blackmail/sextortion": "Sextortion",
    "cyberbullying": "Cyberbullying/Harassment",
    "stalking": "Cyberbullying/Harassment",
    "threatening messages": "Cyberbullying/Harassment",
    "cyber defamation": "Cyberbullying/Harassment",
    "fake accounts/impersonation": "Social Media Scam",
    "morphed images/deepfakes": "Social Media Scam",
    "illegal content sharing": "Social Media Scam",
    "misinformation spreading": "Social Media Scam",
    "online gambling/betting": "Financial Fraud",
    "data breach": "Other",
    "copyright violation": "Other",
    "miscellaneous": "Other",
    "ransomware attack": "Other",
    "spyware/keylogger": "Other",
    "virus/trojan": "Other",
}

INDIA_MAP = {
    "kyc_suspension": "Phishing",
    "courier_scam": "Phishing",
    "electricity_scam": "Phishing",
    "tax_refund_scam": "Phishing",
    "job_scam": "Job/Employment Scam",
    "lottery_scam": "Financial Fraud",
    "echallan_scam": "Phishing",
    "digital_arrest": "Financial Fraud",
}

CHAKRA_MAP = {
    "otp_theft": "UPI Fraud",
    "upi_collect": "UPI Fraud",
    "phishing": "Phishing",
    "investment": "Investment Scam",
    "job": "Job/Employment Scam",
    "kyc": "Phishing",
}

HTML_RE = re.compile(r"<[^>]+>")


def _clean(text: str) -> str:
    t = HTML_RE.sub(" ", str(text or ""))
    return re.sub(r"\s+", " ", t).strip()


def from_complaints() -> pd.DataFrame:
    path = DATASETS / "cybercrime_complaints_300k_fixed (1)-selected-columns.csv"
    if not path.exists():
        path = DATASETS / "cybercrime_complaints_300k_fixed (1).csv"
    df = pd.read_csv(path, usecols=["complaint_text", "sub_category"])
    df["crime_category"] = df["sub_category"].astype(str).str.lower().map(SUB_MAP).fillna("Other")
    df["complaint_text"] = df["complaint_text"].map(_clean)
    return df[["complaint_text", "crime_category"]]


def from_india() -> pd.DataFrame:
    path = DATASETS / "india_fraud_detection_FINAL.csv"
    if not path.exists():
        return pd.DataFrame(columns=["complaint_text", "crime_category"])
    df = pd.read_csv(path)
    df = df[df["label"] == 1].copy()
    df["crime_category"] = df["category"].astype(str).str.lower().map(INDIA_MAP).fillna("Phishing")
    df["complaint_text"] = df["message_text"].map(_clean)
    return df[["complaint_text", "crime_category"]]


def from_chakra() -> pd.DataFrame:
    path = DATASETS / "chakravyuh-bench-v0" / "scenarios.jsonl"
    if not path.exists():
        return pd.DataFrame(columns=["complaint_text", "crime_category"])
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        obj = json.loads(line)
        seq = obj.get("attack_sequence") or []
        text = " ".join(str(t.get("text") or "") for t in seq)
        raw = str((obj.get("ground_truth") or {}).get("category") or "").lower()
        label = CHAKRA_MAP.get(raw)
        if not label:
            if "upi" in raw or "otp" in raw:
                label = "UPI Fraud"
            elif "phish" in raw:
                label = "Phishing"
            else:
                label = "Financial Fraud"
        rows.append({"complaint_text": _clean(text), "crime_category": label})
    return pd.DataFrame(rows)


def from_jobs() -> pd.DataFrame:
    path = DATASETS / "DataSet.csv"
    if not path.exists():
        return pd.DataFrame(columns=["complaint_text", "crime_category"])
    df = pd.read_csv(path, usecols=["title", "description", "fraudulent"])
    fraud = df["fraudulent"].astype(str).str.lower().isin(["t", "true", "1"])
    df = df[fraud].copy()
    df["complaint_text"] = (df["title"].fillna("") + " " + df["description"].fillna("")).map(_clean)
    df["crime_category"] = "Job/Employment Scam"
    return df[["complaint_text", "crime_category"]]


def cap_per_class(df: pd.DataFrame, n: int) -> pd.DataFrame:
    parts = []
    for _, g in df.groupby("crime_category"):
        parts.append(g.sample(n=min(n, len(g)), random_state=42) if len(g) > n else g)
    return pd.concat(parts, ignore_index=True).sample(frac=1, random_state=42)


def main():
    labels = set(load_categories())
    frames = [from_complaints(), from_india(), from_chakra(), from_jobs()]
    from ml.data.generate_complaints import generate_rows
    frames.append(pd.DataFrame(generate_rows(n_per_class=40), columns=["complaint_text", "crime_category"]))
    df = pd.concat(frames, ignore_index=True)
    df = df[df["complaint_text"].astype(str).str.len() >= 20]
    df = df[df["crime_category"].isin(labels)]
    df = df.drop_duplicates(subset=["complaint_text"])
    before = df["crime_category"].value_counts().to_dict()
    df = cap_per_class(df, MAX_PER_CLASS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT, index=False)
    # train.py currently reads complaints_synthetic.csv
    synth = ROOT / "data" / "complaints_synthetic.csv"
    df.to_csv(synth, index=False)
    print(f"Wrote {len(df)} rows to {OUT}")
    print("counts before cap:", before)
    print("counts after cap:\n", df["crime_category"].value_counts().to_string())


if __name__ == "__main__":
    main()
