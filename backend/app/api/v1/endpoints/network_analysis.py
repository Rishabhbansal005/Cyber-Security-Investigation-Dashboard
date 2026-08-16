import os
import tempfile
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.core.supabase_client import get_supabase_admin
from app.core.security import get_current_user, require_investigator, CurrentUser
from app.services.forensics.wireshark_adapter import WiresharkAdapter
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/network", tags=["Network Analysis"])

async def download_file_to_temp(url: str) -> str:
    """Download a file from a URL to a temporary file on disk."""
    fd, temp_path = tempfile.mkstemp(suffix=".pcap")
    os.close(fd)
    
    async with httpx.AsyncClient() as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            with open(temp_path, "wb") as f:
                async for chunk in response.aiter_bytes(chunk_size=8192):
                    f.write(chunk)
    return temp_path

async def run_network_analysis_task(evidence_id: str, case_id: str, download_url: str, user_id: str):
    """Background task to run Wireshark analysis and save results."""
    db = get_supabase_admin()
    temp_path = None
    try:
        # Update status to analyzing
        db.table("network_analysis_results").update({"analysis_status": "analyzing"}).eq("evidence_id", evidence_id).execute()
        
        # Download
        logger.info(f"[NETWORK] Downloading PCAP for evidence {evidence_id}")
        temp_path = await download_file_to_temp(download_url)
        file_size = os.path.getsize(temp_path) if temp_path and os.path.exists(temp_path) else 0
        logger.info(f"[NETWORK] Downloaded to {temp_path}, size={file_size} bytes")
        
        if file_size < 24:
            raise ValueError(f"Downloaded file is too small ({file_size} bytes) — likely a bad URL or storage error")
        
        # Analyze
        logger.info(f"[NETWORK] Starting tshark analysis on {temp_path}")
        adapter = WiresharkAdapter()
        results = await adapter.analyze_pcap(temp_path)
        logger.info(f"[NETWORK] Analysis done: {len(results['conversations'])} conversations, {len(results['dns_queries'])} DNS queries")

        
        # Save results
        db.table("network_analysis_results").update({
            "analysis_status": "completed",
            "protocol_stats": results["protocol_stats"],
            "conversations": results["conversations"],
            "dns_queries": results["dns_queries"],
            "suspicious_indicators": results["suspicious_indicators"],
            "updated_at": datetime.utcnow().isoformat()
        }).eq("evidence_id", evidence_id).execute()
        
        # Timeline Integration: Analysis completed
        db.table("timeline_events").insert({
            "case_id": case_id,
            "evidence_id": evidence_id,
            "title": "Network Analysis Completed",
            "description": f"Extracted {len(results['conversations'])} conversations and {len(results['dns_queries'])} DNS queries.",
            "event_time": datetime.utcnow().isoformat(),
            "event_type": "network_analysis",
            "importance": "normal",
            "created_by": user_id
        }).execute()
        
        # Findings Integration: Auto-generate findings for suspicious indicators
        if results["suspicious_indicators"]:
            for ind in results["suspicious_indicators"]:
                db.table("findings").insert({
                    "case_id": case_id,
                    "evidence_id": evidence_id,
                    "title": f"Suspicious Network Indicator: {ind['value']}",
                    "description": f"Automated network analysis detected suspicious activity. Reason: {ind['reason']}",
                    "severity": "high",
                    "status": "open",
                    "category": "network",
                    "analysis_source": "Network Analysis",
                    "created_by": user_id,
                    "ioc_indicators": [{"type": ind["type"], "value": ind["value"], "confidence": 90}]
                }).execute()
                
            # Timeline Integration: Findings generated
            db.table("timeline_events").insert({
                "case_id": case_id,
                "evidence_id": evidence_id,
                "title": f"Suspicious Indicators Found ({len(results['suspicious_indicators'])})",
                "description": "Network analysis generated new findings from suspicious PCAP traffic.",
                "event_time": datetime.utcnow().isoformat(),
                "event_type": "network",
                "importance": "high",
                "created_by": user_id
            }).execute()

        # Trigger correlation engine which will also update risk
        from app.services.correlation_engine import generate_correlations_for_case
        generate_correlations_for_case(case_id, user_id)
        
        # Mark evidence as analyzed
        db.table("evidence").update({"processing_status": "analyzed"}).eq("id", evidence_id).execute()

        logger.info(f"Network analysis completed for {evidence_id}")

    except Exception as e:
        import traceback
        err_msg = str(e)
        logger.error(f"[NETWORK] FAILED for evidence {evidence_id}: {type(e).__name__}: {err_msg}")
        logger.error(f"[NETWORK] Full traceback:\n{traceback.format_exc()}")
        db.table("network_analysis_results").update({
            "analysis_status": "failed",
            "error_message": err_msg,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("evidence_id", evidence_id).execute()
        db.table("evidence").update({"processing_status": "error"}).eq("id", evidence_id).execute()
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

@router.post("/{evidence_id}/analyze")
async def start_network_analysis(
    evidence_id: str,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(require_investigator)
):
    db = get_supabase_admin()
    
    # 1. Verify evidence exists and is a PCAP
    ev = db.table("evidence").select("id, case_id, storage_bucket, storage_path, evidence_type").eq("id", evidence_id).single().execute()
    if not ev.data:
        raise HTTPException(status_code=404, detail="Evidence not found")
        
    # Check if analysis record exists, if not create it
    res = db.table("network_analysis_results").select("id").eq("evidence_id", evidence_id).execute()
    if not res.data:
        db.table("network_analysis_results").insert({
            "evidence_id": evidence_id,
            "analysis_status": "pending"
        }).execute()
    else:
        db.table("network_analysis_results").update({
            "analysis_status": "pending"
        }).eq("evidence_id", evidence_id).execute()

    # 2. Get signed URL
    url_result = db.storage.from_(ev.data["storage_bucket"]).create_signed_url(
        path=ev.data["storage_path"],
        expires_in=3600
    )
    download_url = url_result.get("signedURL")
    if not download_url:
        raise HTTPException(status_code=500, detail="Failed to generate download URL")

    # 3. Add Timeline event: Started
    db.table("timeline_events").insert({
        "case_id": ev.data["case_id"],
        "evidence_id": evidence_id,
        "title": "Network Analysis Started",
        "description": "Background task initiated to parse PCAP evidence using tshark.",
        "event_time": datetime.utcnow().isoformat(),
        "event_type": "network_analysis",
        "importance": "normal",
        "created_by": current_user.id
    }).execute()

    # 4. Trigger background task
    background_tasks.add_task(run_network_analysis_task, evidence_id, ev.data["case_id"], download_url, current_user.id)
    
    return {"message": "Analysis started in background", "evidence_id": evidence_id}

@router.get("/{evidence_id}/results")
async def get_network_analysis_results(
    evidence_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    db = get_supabase_admin()
    res = db.table("network_analysis_results").select("*").eq("evidence_id", evidence_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Analysis results not found")
    return res.data[0]
