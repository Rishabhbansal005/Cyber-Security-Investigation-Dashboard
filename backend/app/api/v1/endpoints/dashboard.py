from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user, get_current_user_optional, CurrentUser
from app.core.supabase_client import get_supabase_admin
from app.core.config import settings
from app.models.schemas import DashboardStats, Hotspot
import logging
import time
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional
from datetime import datetime
from dateutil.relativedelta import relativedelta
from dateutil import parser as date_parser
import calendar
import httpx

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
logger = logging.getLogger(__name__)

_CASE_COLS = "id,status,priority,created_at,fir_number,case_number,title,jurisdiction,funds_frozen_inr,metadata"
_SUSPECT_COLS = "id,status,funds_linked_inr"


class SimpleCache:
    def __init__(self, ttl_seconds: int = 45):
        self.ttl = ttl_seconds
        self.cache: Dict[str, dict] = {}

    def get(self, key: str) -> Optional[Any]:
        if key in self.cache:
            item = self.cache[key]
            if time.time() - item['timestamp'] < self.ttl:
                return item['data']
            else:
                del self.cache[key]
        return None

    def set(self, key: str, data: Any, ttl: Optional[int] = None):
        self.cache[key] = {
            'timestamp': time.time() - (0 if ttl is None else max(0, self.ttl - ttl)),
            'data': data
        }


dashboard_cache = SimpleCache(ttl_seconds=45)
news_cache = SimpleCache(ttl_seconds=600)


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: CurrentUser = Depends(get_current_user_optional)
):
    try:
        cached_stats = dashboard_cache.get("stats")
        if cached_stats:
            return cached_stats

        def fetch_cases():
            db = get_supabase_admin()
            try:
                return db.table("cases").select(_CASE_COLS).execute()
            except Exception:
                return db.table("cases").select("id,status,priority,created_at,case_number,title,jurisdiction,metadata").execute()

        def fetch_evidence():
            return get_supabase_admin().table("evidence").select("id", count="exact").execute()

        def fetch_findings():
            return get_supabase_admin().table("findings").select("id, severity").execute()

        def fetch_reports():
            return get_supabase_admin().table("reports").select("id", count="exact").execute()

        def fetch_correlations():
            return get_supabase_admin().table("correlations").select("id, correlation_severity").execute()

        def fetch_chains():
            return get_supabase_admin().table("attack_chains").select("id").execute()

        def fetch_suspects():
            db = get_supabase_admin()
            try:
                return db.table("suspects").select(_SUSPECT_COLS).execute()
            except Exception:
                return db.table("suspects").select("id").execute()

        def fetch_activity():
            return get_supabase_admin().table("timeline_events").select("*").order("event_time", desc=True).limit(10).execute()

        jobs = {
            "cases": fetch_cases,
            "evidence": fetch_evidence,
            "findings": fetch_findings,
            "reports": fetch_reports,
            "correlations": fetch_correlations,
            "chains": fetch_chains,
            "suspects": fetch_suspects,
            "activity": fetch_activity,
        }
        # Sequential: 8 parallel PostgREST HTTP/2 streams were getting
        # ConnectionTerminated / Cloudflare 400 and the UI showed all zeros.
        results: Dict[str, Any] = {}
        for name, fn in jobs.items():
            try:
                results[name] = fn()
            except Exception as exc:
                logger.warning("Dashboard query %s failed: %s", name, exc)
                results[name] = None

        cases = (results["cases"].data if results.get("cases") else None) or []
        total_cases = len(cases)
        open_cases = sum(1 for c in cases if c.get("status") == "open")
        active_cases = sum(1 for c in cases if c.get("status") in ("investigating", "active"))
        closed_cases = sum(1 for c in cases if c.get("status") == "closed")

        priority_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for c in cases:
            p = c.get("priority")
            if p in priority_counts:
                priority_counts[p] += 1
        priority_distribution = [{"name": k, "value": v} for k, v in priority_counts.items() if v > 0]

        trend_data = []
        now = datetime.utcnow()
        for i in range(5, -1, -1):
            d = now - relativedelta(months=i)
            trend_data.append({
                "month": calendar.month_abbr[d.month],
                "year": d.year,
                "monthIndex": d.month - 1,
                "cases": 0,
                "closed": 0
            })

        for c in cases:
            created_at_str = c.get("created_at")
            if not created_at_str:
                continue
            dt = date_parser.isoparse(created_at_str)
            for m in trend_data:
                if m["monthIndex"] == (dt.month - 1) and m["year"] == dt.year:
                    m["cases"] += 1
                    if c.get("status") == "closed":
                        m["closed"] += 1
                    break

        evidence_res = results.get("evidence")
        total_evidence = (evidence_res.count if evidence_res and getattr(evidence_res, "count", None) is not None else len((evidence_res.data if evidence_res else None) or []))

        findings = (results["findings"].data if results.get("findings") else None) or []
        total_findings = len(findings)
        critical_findings = sum(1 for f in findings if f.get("severity") == "critical")

        reports_res = results.get("reports")
        reports_generated = (reports_res.count if reports_res and getattr(reports_res, "count", None) is not None else len((reports_res.data if reports_res else None) or []))

        correlations = (results["correlations"].data if results.get("correlations") else None) or []
        total_correlations = len(correlations)
        critical_correlations = sum(1 for c in correlations if c.get("correlation_severity") == "critical")
        chains = (results["chains"].data if results.get("chains") else None) or []
        gangs_identified = len(chains) if chains else critical_correlations

        suspects = (results["suspects"].data if results.get("suspects") else None) or []
        suspects_tracked = len(suspects)
        arrests_made = sum(1 for s in suspects if str(s.get("status") or "").lower() == "arrested")

        funds_frozen = 0.0
        for c in cases:
            meta = c.get("metadata") if isinstance(c.get("metadata"), dict) else {}
            funds_frozen += float(c.get("funds_frozen_inr") or meta.get("funds_frozen_inr") or 0)
        for s in suspects:
            funds_frozen += float(s.get("funds_linked_inr") or 0)

        recent_activity = (results["activity"].data if results.get("activity") else None) or []

        critical_open = [
            c for c in cases
            if c.get("priority") == "critical" and c.get("status") in ("open", "investigating", "active")
        ]
        if critical_open:
            top = critical_open[0]
            ref = top.get("fir_number") or top.get("case_number") or "FIR"
            broadcast_alert = f"Critical open case {ref}: {top.get('title') or 'Untitled'}"
        elif critical_findings:
            broadcast_alert = f"{critical_findings} critical finding(s) require officer review."
        elif total_cases:
            broadcast_alert = f"{active_cases} active investigation(s). {total_cases} FIR(s) on record."
        else:
            broadcast_alert = "No FIRs on record yet. Register a case to begin live operations."

        stats = DashboardStats(
            total_cases=total_cases,
            open_cases=open_cases,
            active_cases=active_cases,
            closed_cases=closed_cases,
            total_evidence=total_evidence,
            total_findings=total_findings,
            critical_findings=critical_findings,
            reports_generated=reports_generated,
            total_correlations=total_correlations,
            critical_correlations=critical_correlations,
            funds_frozen=funds_frozen,
            suspects_tracked=suspects_tracked,
            gangs_identified=gangs_identified,
            arrests_made=arrests_made,
            recent_activity=recent_activity,
            priority_distribution=priority_distribution,
            trend_data=trend_data,
            broadcast_alert=broadcast_alert,
        )
        if results.get("cases") is not None:
            dashboard_cache.set("stats", stats)
        return stats

    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Approximate map positions for NCR cities — used only when a FIR has that jurisdiction.
_CITY_COORDS = {
    "delhi": {"left": 44, "top": 38, "city": "Delhi", "label": "Delhi"},
    "new delhi": {"left": 44, "top": 38, "city": "Delhi", "label": "Delhi"},
    "noida": {"left": 68, "top": 52, "city": "Noida", "label": "Noida"},
    "greater noida": {"left": 78, "top": 68, "city": "Noida", "label": "Greater Noida"},
    "gurugram": {"left": 25, "top": 78, "city": "Gurugram", "label": "Gurugram"},
    "gurgaon": {"left": 25, "top": 78, "city": "Gurugram", "label": "Gurugram"},
    "ghaziabad": {"left": 74, "top": 22, "city": "Ghaziabad", "label": "Ghaziabad"},
    "meerut": {"left": 84, "top": 10, "city": "Meerut", "label": "Meerut"},
    "faridabad": {"left": 56, "top": 82, "city": "Faridabad", "label": "Faridabad"},
}


def _match_city(jurisdiction: str) -> Optional[dict]:
    raw = (jurisdiction or "").strip().lower()
    if not raw:
        return None
    if raw in _CITY_COORDS:
        return _CITY_COORDS[raw]
    for key, coords in _CITY_COORDS.items():
        if key in raw:
            return coords
    return {
        "left": 50,
        "top": 50,
        "city": jurisdiction.strip(),
        "label": jurisdiction.strip(),
    }


@router.get("/hotspots", response_model=List[Hotspot])
async def get_dashboard_hotspots(
    current_user: CurrentUser = Depends(get_current_user_optional)
):
    try:
        cached_hotspots = dashboard_cache.get("hotspots")
        if cached_hotspots:
            return cached_hotspots

        db = get_supabase_admin()
        cases_res = db.table("cases").select("jurisdiction, status, priority").execute()
        buckets: Dict[str, dict] = {}
        for case in (cases_res.data or []):
            coords = _match_city(case.get("jurisdiction") or "")
            if not coords:
                continue
            key = coords["city"]
            bucket = buckets.setdefault(key, {**coords, "count": 0, "severe": False})
            bucket["count"] += 1
            if case.get("status") in ("open", "investigating", "active") and case.get("priority") in ("high", "critical"):
                bucket["severe"] = True

        result = [
            Hotspot(
                id=idx + 1,
                label=b["label"],
                left=b["left"],
                top=b["top"],
                severe=b["severe"] or b["count"] >= 2,
                city=b["city"],
                case_count=b["count"],
            )
            for idx, b in enumerate(buckets.values())
        ]
        dashboard_cache.set("hotspots", result)
        return result
    except Exception as e:
        logger.error(f"Dashboard hotspots error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts")
async def get_dashboard_alerts(
    current_user: CurrentUser = Depends(get_current_user_optional)
):
    """Operational ticker built from live cases and findings — not news APIs."""
    try:
        db = get_supabase_admin()
        alerts = []
        cases_res = db.table("cases").select("case_number, fir_number, title, priority, status, created_at").order("created_at", desc=True).limit(8).execute()
        for c in (cases_res.data or []):
            ref = c.get("fir_number") or c.get("case_number")
            alerts.append({
                "title": f"{ref}: {c.get('title') or 'Untitled FIR'}",
                "url": None,
                "source": (c.get("priority") or "medium").upper(),
            })
        findings_res = db.table("findings").select("title, severity, created_at").eq("severity", "critical").order("created_at", desc=True).limit(5).execute()
        for f in (findings_res.data or []):
            alerts.append({
                "title": f"Critical finding: {f.get('title') or 'Untitled'}",
                "url": None,
                "source": "FINDING",
            })
        return alerts[:12]
    except Exception as e:
        logger.error(f"Dashboard alerts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _parse_google_news_rss(xml_text: str) -> List[dict]:
    items = []
    root = ET.fromstring(xml_text)
    for item in root.findall("./channel/item")[:12]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        source_el = item.find("{http://www.google.com/schemas/rss/0.9}source")
        source = (item.findtext("source") or "Forensics")[:40]
        if title:
            items.append({"title": title, "url": link or None, "source": source})
    return items


def _fetch_forensic_articles() -> List[dict]:
    articles: List[dict] = []
    headers = {"User-Agent": "CCID-Dashboard/1.0"}
    try:
        if settings.gnews_api_key:
            url = (
                "https://gnews.io/api/v4/search"
                "?q=cybercrime%20OR%20%22digital%20forensics%22%20OR%20ransomware"
                "&lang=en&country=in&max=10"
                f"&apikey={settings.gnews_api_key}"
            )
            with httpx.Client(timeout=4.0) as client:
                resp = client.get(url, headers=headers)
            if resp.status_code == 200:
                for art in (resp.json().get("articles") or [])[:10]:
                    title = (art.get("title") or "").strip()
                    if title:
                        articles.append({
                            "title": title,
                            "url": art.get("url"),
                            "source": (art.get("source") or {}).get("name") or "GNews",
                        })
            else:
                logger.warning("GNews returned %s: %s", resp.status_code, resp.text[:200])
        if not articles:
            rss_url = (
                "https://news.google.com/rss/search"
                "?q=cybercrime+OR+ransomware+OR+%22digital+forensics%22"
                "&hl=en-IN&gl=IN&ceid=IN:en"
            )
            with httpx.Client(timeout=4.0, follow_redirects=True) as client:
                resp = client.get(rss_url, headers=headers)
            if resp.status_code == 200:
                articles = _parse_google_news_rss(resp.text)
    except Exception as e:
        logger.warning("Forensic news fetch failed: %s", e)
    return [a for a in articles if a.get("title")]


@router.get("/forensic-news")
async def get_forensic_news(
    current_user: CurrentUser = Depends(get_current_user_optional)
):
    """Live digital-forensics / cybercrime headlines. Cached 10 minutes."""
    cached = news_cache.get("forensic_news")
    if cached:
        return cached

    import asyncio
    articles = await asyncio.to_thread(_fetch_forensic_articles)
    if articles:
        news_cache.set("forensic_news", articles)
    return articles

@router.get("/top-syndicate")
async def get_top_syndicate(
    current_user: CurrentUser = Depends(get_current_user_optional)
):
    try:
        db = get_supabase_admin()
        res = db.table("attack_chains").select("title,severity,nodes,edges").execute()
        chains = res.data or []
        
        if not chains:
            return {"nodes": [], "edges": []}
            
        # Find the chain with the most nodes
        largest_chain = max(chains, key=lambda c: len(c.get("nodes", [])))
        
        return {
            "title": largest_chain.get("title", "Top Priority Syndicate"),
            "severity": largest_chain.get("severity", "critical"),
            "nodes": largest_chain.get("nodes", []),
            "edges": largest_chain.get("edges", [])
        }
    except Exception as e:
        logger.error(f"Dashboard top-syndicate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
