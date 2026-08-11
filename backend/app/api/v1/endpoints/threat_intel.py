from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any
from app.services.threatfox_service import ThreatFoxService
from app.services.urlhaus_service import URLhausService
from app.services.otx_service import OTXService
from app.services.threat_intel_manager import ThreatIntelligenceManager

router = APIRouter()

@router.get("/threatfox/recent", response_model=Dict[str, Any])
async def get_recent_threatfox_iocs():
    """Get recent IOCs from ThreatFox API."""
    service = ThreatFoxService()
    result = await service.get_recent_iocs(days=1)
    
    if not result.get("success"):
        raise HTTPException(status_code=503, detail=result.get("error", "Failed to fetch threat intelligence data"))
        
    return result

@router.get("/urlhaus/recent", response_model=Dict[str, Any])
async def get_recent_urlhaus_urls():
    """Get recent URLs from URLhaus API."""
    service = URLhausService()
    result = await service.get_recent_urls()
    
    if not result.get("success"):
        raise HTTPException(status_code=503, detail=result.get("error", "Failed to fetch threat intelligence data"))
        
    return result

@router.get("/otx/recent", response_model=Dict[str, Any])
async def get_recent_otx_pulses():
    """Get recent subscribed pulses from AlienVault OTX API."""
    service = OTXService()
    result = await service.get_recent_pulses(days=1)
    
    if not result.get("success"):
        raise HTTPException(status_code=503, detail=result.get("error", "Failed to fetch OTX threat intelligence"))
        
    return result

@router.get("/ioc/enrich", response_model=Dict[str, Any])
async def enrich_ioc(ioc: str = Query(..., min_length=2, description="IP, domain, URL, or hash to enrich via OTX")):
    """
    Fetch real-time OTX enrichment for a single IOC.
    Returns pulse information, tags, references, MITRE ATT&CK IDs, and malware families.
    Returns a 200 with data=null and a message if no OTX data exists for this IOC.
    The OTX API key is never exposed; all lookups happen server-side.
    """
    service = OTXService()
    result = await service.enrich_ioc(ioc.strip())
    
    if not result.get("success"):
        raise HTTPException(status_code=503, detail=result.get("error", "Failed to enrich IOC via OTX"))
        
    return result

@router.get("/correlated", response_model=Dict[str, Any])
async def get_correlated_threats():
    """Get correlated threat intelligence from all active providers (ThreatFox, URLhaus, OTX)."""
    manager = ThreatIntelligenceManager()
    result = await manager.get_correlated_threats()
    
    if not result.get("success"):
        raise HTTPException(status_code=503, detail="Failed to fetch and correlate threat intelligence data")
        
    return result

@router.get("/timeline", response_model=Dict[str, Any])
async def get_threat_timeline(
    time_range: str = Query("24h", alias="range", regex="^(1h|24h|7d)$", description="Time range: 1h, 24h, or 7d")
):
    """
    Returns bucketed threat event counts for the Threat Activity Timeline chart.
    Derived from correlated threats data — no additional external API calls.
    Range options: 1h (buckets per 5 min), 24h (buckets per hour), 7d (buckets per day).
    """
    from datetime import datetime, timedelta, timezone
    from collections import defaultdict

    manager = ThreatIntelligenceManager()
    result = await manager.get_correlated_threats()

    if not result.get("success"):
        return {"success": True, "data": [], "range": time_range}

    threats = result.get("data", [])
    now = datetime.now(timezone.utc)

    # Define bucket config per range
    if time_range == "1h":
        bucket_count = 12          # 12 × 5 min = 1 hour
        bucket_minutes = 5
        cutoff = now - timedelta(hours=1)
        label_fmt = lambda dt: dt.strftime("%H:%M")
    elif time_range == "24h":
        bucket_count = 24          # 24 × 1 hour = 24 hours
        bucket_minutes = 60
        cutoff = now - timedelta(hours=24)
        label_fmt = lambda dt: dt.strftime("%H:00")
    else:  # 7d
        bucket_count = 7           # 7 × 1 day = 7 days
        bucket_minutes = 60 * 24
        cutoff = now - timedelta(days=7)
        label_fmt = lambda dt: dt.strftime("%b %d")

    # Build empty buckets (oldest → newest)
    buckets = []
    for i in range(bucket_count - 1, -1, -1):
        bucket_start = now - timedelta(minutes=bucket_minutes * (i + 1))
        bucket_end   = now - timedelta(minutes=bucket_minutes * i)
        buckets.append({
            "label": label_fmt(bucket_start),
            "start": bucket_start,
            "end":   bucket_end,
            "count": 0,
        })

    # Parse threat first_seen timestamps and assign to buckets
    for threat in threats:
        raw = threat.get("first_seen") if isinstance(threat, dict) else getattr(threat, "first_seen", None)
        if not raw:
            continue
        try:
            clean = raw.replace(" UTC", "")
            iso   = clean if "T" in clean else clean.replace(" ", "T")
            if not iso.endswith("Z"):
                iso += "Z"
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
            if dt < cutoff:
                continue
            for bucket in buckets:
                if bucket["start"] <= dt < bucket["end"]:
                    bucket["count"] += 1
                    break
        except Exception:
            continue

    return {
        "success": True,
        "range": time_range,
        "data": [{"label": b["label"], "count": b["count"]} for b in buckets],
    }
