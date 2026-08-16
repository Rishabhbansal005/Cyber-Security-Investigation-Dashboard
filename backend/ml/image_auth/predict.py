"""Load trained EfficientNet-B0 and score face crops for synthetic/GAN faces."""
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
ARTIFACT_DIR = ROOT / "artifacts" / "image_auth"
MODEL_PATH = ARTIFACT_DIR / "model.pt"
METRICS_PATH = ARTIFACT_DIR / "metrics.json"
LABELS_PATH = ARTIFACT_DIR / "labels.json"

_lock = threading.Lock()
_model: Optional[nn.Module] = None
_device: Optional[torch.device] = None
_meta: dict[str, Any] = {}
_cascade = None

EVAL_TF = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def _load_meta() -> dict[str, Any]:
    meta: dict[str, Any] = {
        "model": "efficientnet_b0",
        "model_version": "image_auth_v1",
        "disclaimer": (
            "Screens synthetic/GAN faces (typical of fake profiles). "
            "Not a morph/video-deepfake lab tool. WhatsApp forwarding reduces reliability. "
            "Assistive only — not legal proof."
        ),
        "medium_threshold": 0.40,
        "high_threshold": 0.75,
        "class_names": ["authentic", "manipulated"],
    }
    if METRICS_PATH.exists():
        try:
            raw = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
            meta["disclaimer"] = raw.get("disclaimer") or meta["disclaimer"]
            meta["medium_threshold"] = float(raw.get("medium_threshold") or 0.40)
            # Prefer a conservative High for officers, not the 0.50 train threshold.
            stored = float(raw.get("high_concern_threshold") or 0.75)
            meta["high_threshold"] = max(0.75, stored) if stored < 0.75 else stored
            meta["test_auc"] = raw.get("test", {}).get("auc")
            meta["test_accuracy"] = raw.get("test", {}).get("accuracy")
            meta["trained_at"] = raw.get("trained_at")
        except Exception as exc:
            logger.warning("image_auth metrics.json unreadable: %s", exc)
    if LABELS_PATH.exists():
        try:
            labels = json.loads(LABELS_PATH.read_text(encoding="utf-8"))
            meta["class_names"] = labels.get("class_names") or meta["class_names"]
        except Exception:
            pass
    return meta


def ensure_loaded() -> None:
    global _model, _device, _meta
    if _model is not None:
        return
    with _lock:
        if _model is not None:
            return
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                "Image authenticity model is not trained. Missing "
                f"{MODEL_PATH}"
            )
        # CPU for serving: one 224px crop is fast on i7, and avoids 1–2 min CUDA init.
        _device = torch.device("cpu")
        net = models.efficientnet_b0(weights=None)
        in_f = net.classifier[1].in_features
        net.classifier[1] = nn.Linear(in_f, 2)
        ckpt = torch.load(MODEL_PATH, map_location="cpu", weights_only=False)
        state = ckpt["state_dict"] if isinstance(ckpt, dict) and "state_dict" in ckpt else ckpt
        net.load_state_dict(state)
        net.eval()
        _model = net
        _meta = _load_meta()
        logger.info("image_auth model loaded on %s", _device)


def _haar():
    global _cascade
    if _cascade is not None:
        return _cascade
    try:
        import cv2
        path = str(Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml")
        loaded = cv2.CascadeClassifier(path)
        _cascade = loaded if not loaded.empty() else False
    except Exception:
        _cascade = False
    return _cascade


def _working_copy(img: Image.Image, max_side: int = 640) -> Image.Image:
    if max(img.size) <= max_side:
        return img
    work = img.copy()
    work.thumbnail((max_side, max_side), Image.Resampling.BILINEAR)
    return work


def _detect_faces(img: Image.Image) -> list[tuple[int, int, int, int]]:
    """Return (x, y, w, h) on the original image. Haar runs on a 640px copy."""
    cascade = _haar()
    if not cascade:
        return []
    import cv2
    import numpy as np
    work = _working_copy(img, 640)
    scale_x = img.width / work.width
    scale_y = img.height / work.height
    gray = cv2.cvtColor(np.array(work.convert("RGB")), cv2.COLOR_RGB2GRAY)
    min_side = max(48, int(min(work.width, work.height) * 0.18))
    raw = cascade.detectMultiScale(
        gray, scaleFactor=1.2, minNeighbors=6, minSize=(min_side, min_side),
    )
    boxes = [
        (int(x * scale_x), int(y * scale_y), int(w * scale_x), int(h * scale_y))
        for (x, y, w, h) in raw
    ]
    if not boxes:
        return []
    boxes.sort(key=lambda b: b[2] * b[3], reverse=True)
    largest = boxes[0][2] * boxes[0][3]
    kept = [b for b in boxes if b[2] * b[3] >= 0.45 * largest]
    return kept[:4]


def _crop_with_margin(img: Image.Image, box: tuple[int, int, int, int], margin: float = 0.18) -> Image.Image:
    x, y, w, h = box
    mx, my = int(w * margin), int(h * margin)
    left = max(0, x - mx)
    top = max(0, y - my)
    right = min(img.width, x + w + mx)
    bottom = min(img.height, y + h + my)
    return img.crop((left, top, right, bottom))


@torch.no_grad()
def _score_pil(img: Image.Image) -> float:
    ensure_loaded()
    assert _model is not None and _device is not None
    tensor = EVAL_TF(_working_copy(img, 512).convert("RGB")).unsqueeze(0)
    logits = _model(tensor)
    prob = torch.softmax(logits, dim=1)[0, 1].item()
    return float(prob)


def _concern(prob: float, meta: dict[str, Any], faces_found: bool) -> str:
    if not faces_found:
        return "inconclusive"
    high = float(meta.get("high_threshold") or 0.75)
    mid = float(meta.get("medium_threshold") or 0.40)
    if prob >= high:
        return "high"
    if prob >= mid:
        return "medium"
    return "low"


def analyze_image(image_bytes: bytes, filename: str = "upload.jpg") -> dict[str, Any]:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return analyze_pil(img, filename)


def analyze_pil(img: Image.Image, filename: str = "upload.jpg") -> dict[str, Any]:
    ensure_loaded()
    meta = _meta or _load_meta()
    boxes = _detect_faces(img)
    face_results: list[dict[str, Any]] = []
    if boxes:
        for i, box in enumerate(boxes[:8]):
            crop = _crop_with_margin(img, box)
            p = _score_pil(crop)
            face_results.append({
                "index": i,
                "box": {"x": box[0], "y": box[1], "w": box[2], "h": box[3]},
                "manipulated_probability": round(p, 4),
                "label": "manipulated" if p >= 0.5 else "authentic",
            })
        agg = max(f["manipulated_probability"] for f in face_results)
        mode = "face_crops"
        suspected = "gan_screen_did_not_fire" if agg < 0.5 else "synthetic_or_gan_face"
    else:
        p = _score_pil(img)
        face_results.append({
            "index": 0,
            "box": None,
            "manipulated_probability": round(p, 4),
            "label": "manipulated" if p >= 0.5 else "authentic",
            "note": "No face detected — scored full frame as reference only.",
        })
        agg = p
        mode = "full_frame"
        suspected = "inconclusive_no_face"

    concern = _concern(agg, meta, faces_found=bool(boxes))
    if concern == "high":
        suspected = "synthetic_or_gan_face"
    elif concern == "medium":
        suspected = "review_recommended"
    elif concern == "low" and boxes:
        suspected = "gan_screen_did_not_fire"

    notes = [
        "This detector was trained on older StyleGAN fake faces, not Midjourney / Flux / ChatGPT portraits. "
        "A low score does not prove the photo came from a camera.",
    ]
    if not boxes:
        notes.append("No reliable face box — do not treat the percentage as a finding.")
    if len(boxes) == 1:
        notes.append("One primary face used for scoring (small Haar false-positives are ignored).")

    return {
        "filename": filename,
        "image_size": {"width": img.width, "height": img.height},
        "concern_level": concern,
        "suspected_type": suspected,
        "aggregate_manipulated_probability": round(float(agg), 4),
        "faces_detected": len(boxes),
        "scoring_mode": mode,
        "faces": face_results,
        "officer_notes": notes,
        "thresholds": {
            "medium": meta.get("medium_threshold"),
            "high": meta.get("high_threshold"),
        },
        "model": meta.get("model"),
        "model_version": meta.get("model_version"),
        "trained_at": meta.get("trained_at"),
        "lab_test_auc": meta.get("test_auc"),
        "lab_test_accuracy": meta.get("test_accuracy"),
        "is_prototype": True,
        "disclaimer": meta.get("disclaimer"),
    }
