"""Regex-first entity extraction from complaint text."""
from __future__ import annotations

import re
from typing import Any

PHONE_RE = re.compile(r"(?:\+91[\s-]?)?[6-9]\d{9}\b")
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
UPI_RE = re.compile(r"\b[\w.\-]{2,256}@[a-zA-Z]{2,64}\b")
URL_RE = re.compile(r"https?://[^\s<>\"']+|www\.[^\s<>\"']+", re.I)
HANDLE_RE = re.compile(r"(?:instagram|whatsapp|facebook|telegram|twitter|x\.com)[:\s/@]+([\w.]{2,40})", re.I)
AT_HANDLE_RE = re.compile(r"(?<!\w)@([A-Za-z0-9_.]{2,30})\b")
AMOUNT_RE = re.compile(r"(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rs)\b", re.I)
TXN_RE = re.compile(r"\b(?:UTR|TXN|TXNID|REF)[:\s-]*([A-Z0-9]{8,22})\b", re.I)
ACCOUNT_RE = re.compile(r"\b(?:a/?c|account)[:\s-]*(\d{9,18})\b", re.I)


def mask_value(entity_type: str, value: str) -> str:
    v = value.strip()
    if entity_type == "phone":
        digits = re.sub(r"\D", "", v)
        if len(digits) >= 10:
            return digits[:4] + "****" + digits[-2:]
        return v[:2] + "****"
    if entity_type in ("email", "upi"):
        if "@" in v:
            name, domain = v.split("@", 1)
            shown = name[:2] + "***" if len(name) > 2 else "***"
            return f"{shown}@{domain}"
        return "***"
    if entity_type == "account":
        return v[:2] + "****" + v[-2:] if len(v) > 4 else "****"
    if entity_type == "url":
        return v[:24] + ("…" if len(v) > 24 else "")
    return v


def _parse_amount(raw: str) -> float | None:
    try:
        return float(raw.replace(",", ""))
    except ValueError:
        return None


def extract_entities(text: str) -> list[dict[str, Any]]:
    if not text:
        return []
    found: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    def add(etype: str, raw: str, extra: dict | None = None):
        val = raw.strip().rstrip(".,;)")
        key = (etype, val.lower())
        if not val or key in seen:
            return
        seen.add(key)
        item = {
            "type": etype,
            "value_raw": val,
            "value_masked": mask_value(etype, val),
            "normalized": val.lower(),
        }
        if extra:
            item.update(extra)
        found.append(item)

    for m in PHONE_RE.finditer(text):
        add("phone", m.group(0))
    for m in EMAIL_RE.finditer(text):
        val = m.group(0)
        if val.lower().endswith(("@upi", "@ybl", "@okaxis", "@okicici", "@oksbi", "@paytm", "@apl", "@ibl")):
            add("upi", val)
        else:
            add("email", val)
    for m in UPI_RE.finditer(text):
        val = m.group(0)
        if EMAIL_RE.fullmatch(val) and "." in val.split("@")[-1]:
            continue
        add("upi", val)
    for m in URL_RE.finditer(text):
        add("url", m.group(0))
    for m in HANDLE_RE.finditer(text):
        add("social_handle", m.group(1))
    for m in AT_HANDLE_RE.finditer(text):
        handle = m.group(1)
        if "." in handle and handle.count(".") >= 1 and len(handle) > 8:
            continue
        add("social_handle", "@" + handle)
    for m in AMOUNT_RE.finditer(text):
        raw = m.group(1) or m.group(2)
        if not raw:
            continue
        amt = _parse_amount(raw)
        add("amount", raw, {"amount_inr": amt})
    for m in TXN_RE.finditer(text):
        add("transaction_id", m.group(1))
    for m in ACCOUNT_RE.finditer(text):
        add("account", m.group(1))

    return found


def max_amount_inr(entities: list[dict[str, Any]]) -> float:
    amounts = [e.get("amount_inr") for e in entities if e.get("type") == "amount" and e.get("amount_inr") is not None]
    return max(amounts) if amounts else 0.0
