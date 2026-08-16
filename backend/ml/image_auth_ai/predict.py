"""Score a full frame for AI-generated vs photographic (separate from GAN faces)."""
from __future__ import annotations

import io
import json
import logging
import threading
from pathlib import Path
from typing import Any, Optional

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = ROOT / "artifacts" / "image_auth_ai"
MODEL_PATH = ARTIFACT_DIR / "model.pt"
METRICS_PATH = ARTIFACT_DIR / "metrics.json"
LABELS_PATH = ARTIFACT_DIR / "labels.json"

_lock = threading.Lock()
_model: Optional[nn.Module] = None
_meta: dict[str, Any] = {}

EVAL_TF = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def model_available() -> bool:
    return MODEL_PATH.exists()


def _load_meta() -> dict[str, Any]:
    meta: dict[str, Any] = {
        "model": "efficientnet_b0",
        "model_version": "image_auth_ai_v1",
        "disclaimer": (
            "Screens still images for common diffusion / DALL-E / Midjourney traces. "
            "ChatGPT Images, Flux, and new tools can be missed. Assistive only — not legal proof."
        ),
        "medium_threshold": 0.40,
        "high_threshold": 0.75,
        "class_names": ["authentic", "generated"],
    }
    if METRICS_PATH.exists():
        try:
            raw = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
            meta["disclaimer"] = raw.get("disclaimer") or meta["disclaimer"]
            meta["medium_threshold"] = float(raw.get("medium_threshold") or 0.40)
            stored = float(raw.get("high_concern_threshold") or 0.75)
            meta["high_threshold"] = max(0.75, stored) if stored < 0.75 else stored
            meta["test_auc"] = raw.get("test", {}).get("auc")
            meta["test_accuracy"] = raw.get("test", {}).get("accuracy")
            meta["trained_at"] = raw.get("trained_at")
        except Exception as exc:
            logger.warning("image_auth_ai metrics.json unreadable: %s", exc)
    if LABELS_PATH.exists():
        try:
            labels = json.loads(LABELS_PATH.read_text(encoding="utf-8"))
            meta["class_names"] = labels.get("class_names") or meta["class_names"]
        except Exception:
            pass
    return meta


def ensure_loaded() -> None:
    global _model, _meta
    if _model is not None:
        return
    with _lock:
        if _model is not None:
            return
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                "AI vs real model is not trained. Missing "
                f"{MODEL_PATH}"
            )
        net = models.efficientnet_b0(weights=None)
        in_f = net.classifier[1].in_features
        net.classifier[1] = nn.Linear(in_f, 2)
        ckpt = torch.load(MODEL_PATH, map_location="cpu", weights_only=False)
        state = ckpt["state_dict"] if isinstance(ckpt, dict) and "state_dict" in ckpt else ckpt
        net.load_state_dict(state)
        net.eval()
        _model = net
        _meta = _load_meta()
        logger.info("image_auth_ai model loaded on cpu")


@torch.no_grad()
def _score_pil(img: Image.Image) -> float:
    ensure_loaded()
    assert _model is not None
    work = img
    if max(img.size) > 512:
        work = img.copy()
        work.thumbnail((512, 512), Image.Resampling.BILINEAR)
    tensor = EVAL_TF(work.convert("RGB")).unsqueeze(0)
    logits = _model(tensor)
    return float(torch.softmax(logits, dim=1)[0, 1].item())


def _concern(prob: float, meta: dict[str, Any]) -> str:
    high = float(meta.get("high_threshold") or 0.75)
    mid = float(meta.get("medium_threshold") or 0.40)
    if prob >= high:
        return "high"
    if prob >= mid:
        return "medium"
    return "low"


def analyze_ai_image(image_bytes: bytes, filename: str = "upload.jpg") -> dict[str, Any]:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return analyze_ai_pil(img, filename)


def analyze_ai_pil(img: Image.Image, filename: str = "upload.jpg") -> dict[str, Any]:
    """Full-frame AI vs real. Faces are not required (landscapes, products, portraits)."""
    ensure_loaded()
    meta = _meta or _load_meta()
    p = _score_pil(img)
    concern = _concern(p, meta)
    if concern == "high":
        suspected = "ai_generated_screen"
    elif concern == "medium":
        suspected = "review_recommended"
    else:
        suspected = "ai_screen_did_not_fire"
    return {
        "available": True,
        "filename": filename,
        "concern_level": concern,
        "suspected_type": suspected,
        "ai_generated_probability": round(p, 4),
        "scoring_mode": "full_frame",
        "thresholds": {
            "medium": meta.get("medium_threshold"),
            "high": meta.get("high_threshold"),
        },
        "model": meta.get("model"),
        "model_version": meta.get("model_version"),
        "trained_at": meta.get("trained_at"),
        "lab_test_auc": meta.get("test_auc"),
        "lab_test_accuracy": meta.get("test_accuracy"),
        "disclaimer": meta.get("disclaimer"),
        "officer_notes": [
            "This meter is separate from the old GAN-face test.",
            "Trained on public SD / SDXL / SD3 / DALL-E 3 / Midjourney stills, not ChatGPT Images or Flux.",
            "A low score does not prove a camera photograph.",
        ],
    }


def unavailable_payload() -> dict[str, Any]:
    return {
        "available": False,
        "concern_level": "unavailable",
        "ai_generated_probability": None,
        "officer_notes": [
            "AI vs real model is not on disk yet. Train with: python -m ml.image_auth_ai.train",
        ],
        "disclaimer": "AI vs real screen not loaded.",
    }
