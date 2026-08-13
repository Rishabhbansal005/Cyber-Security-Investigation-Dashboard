"""Turn an uploaded complaint file into plain text (no real citizen PII required)."""
from __future__ import annotations

import csv
import io
import json


def extract_text_from_bytes(filename: str, content: bytes) -> str:
    name = (filename or "complaint.txt").lower()
    raw = content.decode("utf-8", errors="replace").strip()
    if not raw:
        raise ValueError("File is empty.")

    if name.endswith(".json"):
        data = json.loads(raw)
        if isinstance(data, dict):
            return str(
                data.get("complaint_text")
                or data.get("description")
                or data.get("text")
                or data.get("narrative")
                or json.dumps(data)
            ).strip()
        if isinstance(data, list) and data:
            first = data[0]
            if isinstance(first, dict):
                return str(first.get("complaint_text") or first.get("description") or first.get("text") or first).strip()
        return raw

    if name.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(raw))
        fieldnames = [f.lower() for f in (reader.fieldnames or [])]
        rows = list(reader)
        if not rows:
            return raw
        prefer = ("complaint_text", "description", "narrative", "text", "title")
        col = next((c for c in prefer if c in fieldnames), None)
        if col is None and reader.fieldnames:
            col = reader.fieldnames[0]
            texts = [str(r.get(col) or "").strip() for r in rows]
        else:
            actual = next(f for f in (reader.fieldnames or []) if f.lower() == col)
            texts = [str(r.get(actual) or "").strip() for r in rows]
        joined = "\n\n".join(t for t in texts if t)
        if not joined:
            raise ValueError("CSV has no complaint text.")
        return joined[:20000]

    return raw[:20000]
