import os
import sys
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib

def main():
    print("--- CCID CYBER THREAT ML MODEL TRAINING PIPELINE ---")

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    data_dir = os.path.join(base_dir, "data")
    models_dir = os.path.join(base_dir, "app", "models")
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    csv_path = os.path.join(data_dir, "cyber_threat_dataset.csv")
    model_path = os.path.join(models_dir, "cyber_threat_model.joblib")

    # Benchmark dataset generation (5000 samples)
    np.random.seed(42)
    n_samples = 5000

    pulse_count = np.random.exponential(scale=10, size=n_samples).astype(int)
    domain_age_days = np.random.randint(1, 3650, size=n_samples)
    open_ports_count = np.random.poisson(lam=2, size=n_samples)
    entropy_score = np.random.uniform(1.5, 4.8, size=n_samples)
    subdomain_depth = np.random.randint(0, 5, size=n_samples)

    risk_metric = (pulse_count * 3.5) + ((3650 - domain_age_days) / 100) + (open_ports_count * 4.0) + (entropy_score * 8.0) + (subdomain_depth * 6.0)
    is_malicious = (risk_metric > 55).astype(int)

    threat_types = []
    for i in range(n_samples):
        if is_malicious[i] == 0:
            threat_types.append("Clean / Low Risk")
        elif pulse_count[i] > 15:
            threat_types.append("Botnet Command & Control (C2)")
        elif entropy_score[i] > 3.8:
            threat_types.append("Phishing / Suspicious Domain")
        elif open_ports_count[i] > 5:
            threat_types.append("Ransomware Infrastructure")
        else:
            threat_types.append("Malware Distribution Node")

    df = pd.DataFrame({
        "pulse_count": pulse_count,
        "domain_age_days": domain_age_days,
        "open_ports_count": open_ports_count,
        "entropy_score": np.round(entropy_score, 2),
        "subdomain_depth": subdomain_depth,
        "is_malicious": is_malicious,
        "threat_type": threat_types
    })

    df.to_csv(csv_path, index=False)
    print(f"[DATASET] Saved 5,000 samples to: {csv_path}")

    X = df[["pulse_count", "domain_age_days", "open_ports_count", "entropy_score", "subdomain_depth"]]
    y = df["is_malicious"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print(f"[TRAINING] Training on {len(X_train)} records...")
    model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train, y_train)

    acc = accuracy_score(y_test, model.predict(X_test))
    print(f"[ACCURACY] {acc * 100:.2f}%")
    print(classification_report(y_test, model.predict(X_test), target_names=["Benign", "Malicious"]))

    joblib.dump({"model": model, "feature_names": list(X.columns), "accuracy": acc}, model_path)
    print(f"[SAVED] Model weights saved to: {model_path}")

if __name__ == "__main__":
    main()
