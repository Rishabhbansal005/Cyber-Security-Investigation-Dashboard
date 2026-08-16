"""Train EfficientNet-B0: authentic photo vs AI-generated (diffusion / DALL-E / MJ).

Separate from the StyleGAN face model. Do not mix class heads.

Fits RTX 4050 6GB: batch 8, AMP, 224px.
Default data: C:\\Users\\asus_pc\\datasets\\image_auth_ai_subset
Writes: backend/ml/artifacts/image_auth_ai/
"""
from __future__ import annotations

import io
import json
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
    roc_auc_score,
)
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = ROOT / "artifacts" / "image_auth_ai"
DEFAULT_DATA = Path(r"C:\Users\asus_pc\datasets\image_auth_ai_subset")

# ImageFolder sorts alphabetically: authentic=0, generated=1
CLASS_NAMES = ["authentic", "generated"]


class RandomJpeg:
    def __init__(self, p: float = 0.5, qmin: int = 40, qmax: int = 85):
        self.p = p
        self.qmin = qmin
        self.qmax = qmax

    def __call__(self, img: Image.Image) -> Image.Image:
        if random.random() > self.p:
            return img
        q = random.randint(self.qmin, self.qmax)
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=q)
        buf.seek(0)
        return Image.open(buf).convert("RGB")


def set_seed(seed: int = 42) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def make_loaders(data_dir: Path, batch_size: int, num_workers: int):
    train_tf = transforms.Compose([
        transforms.Resize((224, 224)),
        RandomJpeg(p=0.55),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(0.15, 0.15, 0.1, 0.05),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    eval_tf = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    train_ds = datasets.ImageFolder(data_dir / "train", transform=train_tf)
    val_ds = datasets.ImageFolder(data_dir / "val", transform=eval_tf)
    test_ds = datasets.ImageFolder(data_dir / "test", transform=eval_tf)
    pin = torch.cuda.is_available()
    train_loader = DataLoader(
        train_ds, batch_size=batch_size, shuffle=True,
        num_workers=num_workers, pin_memory=pin,
    )
    val_loader = DataLoader(
        val_ds, batch_size=batch_size, shuffle=False,
        num_workers=num_workers, pin_memory=pin,
    )
    test_loader = DataLoader(
        test_ds, batch_size=batch_size, shuffle=False,
        num_workers=num_workers, pin_memory=pin,
    )
    return train_loader, val_loader, test_loader, train_ds.class_to_idx


def build_model(device: torch.device) -> nn.Module:
    try:
        weights = models.EfficientNet_B0_Weights.IMAGENET1K_V1
        model = models.efficientnet_b0(weights=weights)
    except Exception:
        model = models.efficientnet_b0(pretrained=True)
    in_f = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_f, 2)
    return model.to(device)


@torch.no_grad()
def run_eval(model, loader, device, use_amp: bool):
    model.eval()
    ys, ps, preds = [], [], []
    for x, y in loader:
        x = x.to(device, non_blocking=True)
        with torch.autocast(device_type=device.type, enabled=use_amp and device.type == "cuda"):
            logits = model(x)
        prob = torch.softmax(logits.float(), dim=1)[:, 1].cpu().numpy()
        pred = (prob >= 0.5).astype(int)
        ys.append(y.numpy())
        ps.append(prob)
        preds.append(pred)
    y_true = np.concatenate(ys)
    y_prob = np.concatenate(ps)
    y_pred = np.concatenate(preds)
    auc = float(roc_auc_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else 0.0
    acc = float(accuracy_score(y_true, y_pred))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))
    return {
        "auc": auc,
        "accuracy": acc,
        "f1": f1,
        "y_true": y_true,
        "y_prob": y_prob,
        "y_pred": y_pred,
    }


def high_threshold(y_true, y_prob, min_precision: float = 0.90) -> float:
    best = 0.75
    for t in np.linspace(0.50, 0.95, 19):
        pred = (y_prob >= t).astype(int)
        prec, _, _, _ = precision_recall_fscore_support(
            y_true, pred, average="binary", zero_division=0
        )
        if prec >= min_precision:
            best = float(t)
            break
    return best


def main():
    data_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DATA
    if not (data_dir / "train").exists():
        raise SystemExit(
            f"Data not found: {data_dir}\n"
            "Run: python -m ml.image_auth_ai.download_subset"
        )

    set_seed(42)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    use_amp = device.type == "cuda"
    batch_size = 8
    epochs = 8
    num_workers = 0
    print(f"device={device} amp={use_amp} data={data_dir}")
    if device.type != "cuda":
        print("WARNING: no GPU — this will be too slow.")

    train_loader, val_loader, test_loader, class_to_idx = make_loaders(
        data_dir, batch_size, num_workers
    )
    print("class_to_idx", class_to_idx)
    if class_to_idx.get("generated") != 1:
        raise SystemExit(
            f"Expected authentic=0 generated=1, got {class_to_idx}. "
            "Folder names must be authentic/ and generated/."
        )

    model = build_model(device)
    opt = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    loss_fn = nn.CrossEntropyLoss()
    scaler = torch.cuda.amp.GradScaler(enabled=use_amp)

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    best_auc = -1.0
    history = []

    for epoch in range(1, epochs + 1):
        model.train()
        t0 = time.time()
        running = 0.0
        n = 0
        for x, y in train_loader:
            x = x.to(device, non_blocking=True)
            y = y.to(device, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            with torch.autocast(device_type=device.type, enabled=use_amp):
                logits = model(x)
                loss = loss_fn(logits, y)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            running += loss.item() * x.size(0)
            n += x.size(0)
        sched.step()
        val = run_eval(model, val_loader, device, use_amp)
        row = {
            "epoch": epoch,
            "train_loss": running / max(n, 1),
            "val_auc": val["auc"],
            "val_acc": val["accuracy"],
            "val_f1": val["f1"],
            "seconds": round(time.time() - t0, 1),
        }
        history.append(row)
        print(
            f"epoch {epoch}/{epochs} loss={row['train_loss']:.4f} "
            f"val_auc={row['val_auc']:.4f} val_acc={row['val_acc']:.4f} "
            f"time={row['seconds']}s"
        )
        if val["auc"] > best_auc:
            best_auc = val["auc"]
            torch.save({
                "state_dict": model.state_dict(),
                "class_to_idx": class_to_idx,
                "class_names": CLASS_NAMES,
                "val_auc": best_auc,
            }, ARTIFACT_DIR / "model.pt")
            print(f"  saved best model (val_auc={best_auc:.4f})")

    ckpt = torch.load(ARTIFACT_DIR / "model.pt", map_location=device, weights_only=False)
    model.load_state_dict(ckpt["state_dict"])
    test = run_eval(model, test_loader, device, use_amp)
    thr = high_threshold(test["y_true"], test["y_prob"], 0.90)
    high_pred = (test["y_prob"] >= thr).astype(int)
    prec_h, rec_h, f1_h, _ = precision_recall_fscore_support(
        test["y_true"], high_pred, average="binary", zero_division=0
    )
    report = classification_report(
        test["y_true"], test["y_pred"], target_names=CLASS_NAMES, digits=4
    )
    cm = confusion_matrix(test["y_true"], test["y_pred"]).tolist()
    metrics = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "data_dir": str(data_dir),
        "model": "efficientnet_b0",
        "task": "ai_vs_real",
        "epochs": epochs,
        "batch_size": batch_size,
        "device": str(device),
        "class_to_idx": class_to_idx,
        "val_best_auc": best_auc,
        "test": {
            "auc": test["auc"],
            "accuracy": test["accuracy"],
            "f1": test["f1"],
            "confusion_matrix": cm,
            "report": report,
        },
        "high_concern_threshold": thr,
        "high_concern_test": {
            "precision": float(prec_h),
            "recall": float(rec_h),
            "f1": float(f1_h),
        },
        "history": history,
        "disclaimer": (
            "Screens still images for traces of common diffusion / DALL-E / Midjourney generators "
            "seen in public training data. ChatGPT Images, Flux, and new tools can be missed. "
            "WhatsApp compression reduces reliability. Assistive only — not legal proof."
        ),
        "medium_threshold": 0.40,
    }
    (ARTIFACT_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (ARTIFACT_DIR / "labels.json").write_text(
        json.dumps({"class_names": CLASS_NAMES, "class_to_idx": class_to_idx}, indent=2),
        encoding="utf-8",
    )
    print("\nTEST\n" + report)
    print(f"test AUC={test['auc']:.4f}  High threshold={thr:.2f}  "
          f"High precision={prec_h:.3f} recall={rec_h:.3f}")
    print(f"wrote {ARTIFACT_DIR / 'model.pt'}")


if __name__ == "__main__":
    main()
