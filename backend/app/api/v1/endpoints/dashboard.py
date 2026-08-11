from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user, CurrentUser
from app.core.supabase_client import get_supabase_admin
from app.models.schemas import DashboardStats, Hotspot
import logging
import time
from typing import Any, Dict, List, Optional

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
logger = logging.getLogger(__name__)

# Simple TTL Cache to reduce Supabase API hits and speed up dashboard loading
class SimpleCache:
    def __init__(self, ttl_seconds: int = 15):
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

    def set(self, key: str, data: Any):
        self.cache[key] = {
            'timestamp': time.time(),
            'data': data
        }

dashboard_cache = SimpleCache(ttl_seconds=15)

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: CurrentUser = Depends(get_current_user)
):
    try:
        cached_stats = dashboard_cache.get("stats")
        if cached_stats:
            return cached_stats

        db = get_supabase_admin()
        
        # 1. Fetch cases
        cases_res = db.table("cases").select("id, status, priority, created_at").execute()
        cases = cases_res.data or []
        total_cases = len(cases)
        open_cases = sum(1 for c in cases if c.get("status") == "open")
        active_cases = sum(1 for c in cases if c.get("status") == "investigating" or c.get("status") == "active")
        closed_cases = sum(1 for c in cases if c.get("status") == "closed")

        # Priority distribution
        priority_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for c in cases:
            p = c.get("priority")
            if p in priority_counts:
                priority_counts[p] += 1
        
        priority_distribution = [{"name": k, "value": v} for k, v in priority_counts.items() if v > 0]

        # Trend Data (Last 6 Months)
        from datetime import datetime
        from dateutil.relativedelta import relativedelta
        from dateutil import parser
        import calendar

        trend_data = []
        now = datetime.utcnow()
        for i in range(5, -1, -1):
            d = now - relativedelta(months=i)
            trend_data.append({
                "month": calendar.month_abbr[d.month],
                "year": d.year,
                "monthIndex": d.month - 1, # 0-indexed
                "cases": 0,
                "closed": 0
            })

        for c in cases:
            created_at_str = c.get("created_at")
            if not created_at_str:
                continue
            dt = parser.isoparse(created_at_str)
            for m in trend_data:
                if m["monthIndex"] == (dt.month - 1) and m["year"] == dt.year:
                    m["cases"] += 1
                    if c.get("status") == "closed":
                        m["closed"] += 1
                    break

        # 2. Fetch evidence count
        evidence_res = db.table("evidence").select("id", count="exact").execute()
        total_evidence = evidence_res.count if hasattr(evidence_res, "count") and evidence_res.count is not None else len(evidence_res.data or [])

        # 3. Fetch findings
        findings_res = db.table("findings").select("id, severity").execute()
        findings = findings_res.data or []
        total_findings = len(findings)
        critical_findings = sum(1 for f in findings if f.get("severity") == "critical")

        # 4. Fetch reports count
        reports_res = db.table("reports").select("id", count="exact").execute()
        reports_generated = reports_res.count if hasattr(reports_res, "count") and reports_res.count is not None else len(reports_res.data or [])

        # 4.5 Fetch Correlations
        correlations_res = db.table("correlations").select("id, correlation_severity").execute()
        correlations = correlations_res.data or []
        total_correlations = len(correlations)
        critical_correlations = sum(1 for c in correlations if c.get("correlation_severity") == "critical")
        gangs_identified = critical_correlations

        # 4.6 Fetch Suspects
        suspects_res = db.table("suspects").select("id", count="exact").execute()
        suspects_tracked = suspects_res.count if hasattr(suspects_res, "count") and suspects_res.count is not None else len(suspects_res.data or [])

        # 4.7 Calculate Funds Frozen (Estimate based on closed/active cases)
        funds_frozen = round((closed_cases * 0.15) + (active_cases * 0.05), 2)

        # 5. Fetch recent activity (Global Timeline)
        activity_res = db.table("timeline_events").select("*").order("event_time", desc=True).limit(10).execute()
        recent_activity = activity_res.data or []

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
            recent_activity=recent_activity,
            priority_distribution=priority_distribution,
            trend_data=trend_data
        )
        dashboard_cache.set("stats", stats)
        return stats
        
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/hotspots", response_model=List[Hotspot])
async def get_dashboard_hotspots(
    current_user: CurrentUser = Depends(get_current_user)
):
    try:
        cached_hotspots = dashboard_cache.get("hotspots")
        if cached_hotspots:
            return cached_hotspots
        # Static base hotspots across Delhi NCR
        base_hotspots = [
            {"id": 1, "label": "Dwarka Sec-12", "left": 22, "top": 44, "severe": True, "city": "Delhi"},
            {"id": 2, "label": "Rohini", "left": 32, "top": 22, "severe": False, "city": "Delhi"},
            {"id": 3, "label": "Seelampur", "left": 55, "top": 20, "severe": False, "city": "Delhi"},
            {"id": 4, "label": "Connaught Place", "left": 44, "top": 38, "severe": True, "city": "Delhi"},
            {"id": 5, "label": "Lajpat Nagar", "left": 50, "top": 52, "severe": False, "city": "Delhi"},
            {"id": 6, "label": "Saket", "left": 42, "top": 62, "severe": False, "city": "Delhi"},
            {"id": 7, "label": "Pitampura", "left": 28, "top": 16, "severe": False, "city": "Delhi"},
            {"id": 8, "label": "Shahdara", "left": 62, "top": 30, "severe": True, "city": "Delhi"},
            {"id": 9, "label": "Hauz Khas", "left": 38, "top": 68, "severe": False, "city": "Delhi"},
            {"id": 10, "label": "Jahangirpuri", "left": 38, "top": 12, "severe": False, "city": "Delhi"},
            {"id": 11, "label": "Noida Sec-62", "left": 68, "top": 52, "severe": True, "city": "Noida"},
            {"id": 12, "label": "Greater Noida", "left": 78, "top": 68, "severe": False, "city": "Noida"},
            {"id": 13, "label": "Noida Sec-18", "left": 72, "top": 44, "severe": False, "city": "Noida"},
            {"id": 14, "label": "Gurugram Cyber Hub", "left": 25, "top": 78, "severe": True, "city": "Gurugram"},
            {"id": 15, "label": "Manesar", "left": 14, "top": 86, "severe": False, "city": "Gurugram"},
            {"id": 16, "label": "Sohna Road", "left": 32, "top": 86, "severe": False, "city": "Gurugram"},
            {"id": 17, "label": "Ghaziabad", "left": 74, "top": 22, "severe": True, "city": "Ghaziabad"},
            {"id": 18, "label": "Meerut", "left": 84, "top": 10, "severe": False, "city": "Meerut"},
            {"id": 19, "label": "Indirapuram", "left": 68, "top": 34, "severe": False, "city": "Ghaziabad"},
            {"id": 20, "label": "Faridabad", "left": 56, "top": 82, "severe": False, "city": "Faridabad"}
        ]
        
        # We could query db.table("cases").select("jurisdiction") to dynamically update severity
        db = get_supabase_admin()
        cases_res = db.table("cases").select("jurisdiction, status").execute()
        active_jurisdictions = [c.get("jurisdiction") for c in (cases_res.data or []) if c.get("status") in ["open", "investigating", "active"] and c.get("jurisdiction")]
        
        jurisdiction_counts = {}
        for j in active_jurisdictions:
            jurisdiction_counts[j] = jurisdiction_counts.get(j, 0) + 1
            
        for hotspot in base_hotspots:
            city_name = hotspot["city"]
            if jurisdiction_counts.get(city_name, 0) >= 2:
                hotspot["severe"] = True
                
        result = [Hotspot(**h) for h in base_hotspots]
        dashboard_cache.set("hotspots", result)
        return result
        
    except Exception as e:
        logger.error(f"Dashboard hotspots error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
