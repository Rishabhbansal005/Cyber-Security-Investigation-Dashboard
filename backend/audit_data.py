# -*- coding: utf-8 -*-
# noqa: F401
"""Audit utility script — run directly to inspect Supabase table schemas."""
import asyncio
from app.core.supabase_client import get_supabase_admin  # type: ignore[import]

async def main():
    db = get_supabase_admin()
    
    print("--- Timeline Events ---")
    res = db.table("timeline_events").select("event_type, importance").execute()
    events = res.data or []
    print("event_type:", set([e.get("event_type") for e in events]))
    print("importance:", set([e.get("importance") for e in events]))
    
    print("--- Findings ---")
    res = db.table("findings").select("severity, category").execute()
    findings = res.data or []
    print("severity:", set([f.get("severity") for f in findings]))
    print("category:", set([f.get("category") for f in findings]))

if __name__ == "__main__":
    asyncio.run(main())
