"""Shared text cleaning for complaint classification."""
import json
import re
from pathlib import Path

_ML_ROOT = Path(__file__).resolve().parents[1]
_CATEGORIES_PATH = _ML_ROOT / "categories.json"

_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.I)
_WS_RE = re.compile(r"\s+")


def load_categories() -> list[str]:
    data = json.loads(_CATEGORIES_PATH.read_text(encoding="utf-8"))
    return list(data["labels"])


def clean_text(text: str) -> str:
    if not text:
        return ""
    t = text.lower()
    t = _URL_RE.sub(" urltoken ", t)
    t = re.sub(r"[₹$]", " rs ", t)
    t = re.sub(r"[^a-z0-9@.\s]", " ", t)
    t = _WS_RE.sub(" ", t).strip()
    return t


def complaint_text(title: str | None, description: str | None) -> str:
    return clean_text(f"{title or ''} {description or ''}")
