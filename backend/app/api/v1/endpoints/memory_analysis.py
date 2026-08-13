import os
import json
import logging
import tempfile
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from app.core.security import require_investigator, CurrentUser, get_current_user
from app.core.supabase_client import get_supabase_admin
from app.core.config import settings
from app.services.forensics.volatility_adapter import VolatilityAdapter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/memory", tags=["Memory Analysis"])

class MemoryAnalysisResponse(BaseModel):
    message: str
    evidence_id: str

def fetch_evidence(db, evidence_id: str) -> dict:
    ev = db.table("evidence").select("*").eq("id", evidence_id).single().execute()
    if not ev.data:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return ev.data

async def run_volatility_analysis(evidence_id: str, case_id: str, storage_path: str, storage_bucket: str, current_user_id: str):
    db = get_supabase_admin()
    try:
        # Mark as processing
        db.table("memory_analysis_results").update({"analysis_status": "processing"}).eq("evidence_id", evidence_id).execute()
        
        # Download evidence file temporarily
        url_res = db.storage.from_(storage_bucket).create_signed_url(storage_path, 3600)
        signed_url = url_res.get("signedURL")
        if not signed_url:
            raise Exception("Failed to generate signed URL")

        # Download to temp file
        import httpx
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
            async with httpx.AsyncClient() as client:
                async with client.stream("GET", signed_url) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
                        tmp.write(chunk)
        
        try:
            # Run Volatility
            adapter = VolatilityAdapter()
            ev_data = db.table("evidence").select("original_file_name").eq("id", evidence_id).single().execute().data
            original_name = ev_data.get("original_file_name", "") if ev_data else ""
            results = await adapter.analyze_memory(evidence_id, tmp_path, original_name)
            
            # Create findings if needed
            malfind_hits = results.get("suspicious_processes", [])
            if malfind_hits:
                finding_payload = {
                    "case_id": case_id,
                    "evidence_id": evidence_id,
                    "title": f"Injected Code Detected ({len(malfind_hits)} hits)",
                    "description": f"Volatility malfind plugin detected {len(malfind_hits)} injected memory regions.",
                    "severity": "high",
                    "status": "open",
                    "category": "malware",
                    "analysis_source": "Memory Analysis",
                    "ioc_indicators": malfind_hits[:10], # Store top 10 as examples
                    "created_by": current_user_id
                }
                db.table("findings").insert(finding_payload).execute()
                
            # Update DB
            update_payload = {
                "analysis_status": "completed",
                "memory_profile": results.get("memory_profile"),
                "process_list": results.get("process_list", []),
                "process_tree": results.get("process_tree", []),
                "suspicious_processes": results.get("suspicious_processes", []),
                "analysis_summary": results.get("analysis_summary", {}),
                "updated_at": datetime.utcnow().isoformat()
            }
            db.table("memory_analysis_results").update(update_payload).eq("evidence_id", evidence_id).execute()
            
            # Timeline event
            timeline_event = {
                "case_id": case_id,
                "event_type": "memory_analysis",
                "title": "Memory Analysis Completed",
                "description": f"Volatility extracted {len(results.get('process_list', []))} processes and found {len(malfind_hits)} malfind hits.",
                "event_time": datetime.utcnow().isoformat(),
                "created_by": current_user_id,
                "evidence_id": evidence_id
            }
            db.table("timeline_events").insert(timeline_event).execute()

            # Trigger correlation engine which will also update risk
            from app.services.correlation_engine import generate_correlations_for_case
            generate_correlations_for_case(case_id, current_user_id)
            
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                
    except Exception as e:
        # Auto update case risk
        from app.services.risk_service import auto_update_case_risk
        auto_update_case_risk(case_id, current_user_id)

        logger.error(f"Memory analysis failed for evidence {evidence_id}: {e}")
        db.table("memory_analysis_results").update({
            "analysis_status": "failed",
            "error_message": str(e),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("evidence_id", evidence_id).execute()

@router.post("/{evidence_id}/analyze", response_model=MemoryAnalysisResponse)
async def start_memory_analysis(
    evidence_id: str,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(require_investigator)
):
    db = get_supabase_admin()
    ev = fetch_evidence(db, evidence_id)
    
    # Verify file type
    original_name = ev.get("original_file_name", "")
    if not (ev.get("evidence_type") == "memory_dump" or original_name.endswith((".raw", ".mem", ".dmp", ".vmem"))):
        raise HTTPException(status_code=400, detail="Evidence is not a supported memory dump format")

    # File size validation (10MB minimum for real dumps)
    file_size = ev.get("file_size", 0)
    if file_size < 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File size ({file_size} bytes) is too small to be a valid memory dump. Memory dumps are typically larger than 10MB.",
        )

    # Check if already analyzing
    res = db.table("memory_analysis_results").select("id").eq("evidence_id", evidence_id).execute()
    if not res.data:
        db.table("memory_analysis_results").insert({"evidence_id": evidence_id}).execute()

    # Dispatch background task
    background_tasks.add_task(
        run_volatility_analysis,
        evidence_id,
        ev.get("case_id"),
        ev.get("storage_path"),
        ev.get("storage_bucket"),
        current_user.id
    )

    # Dispatch timeline event for starting analysis
    timeline_event = {
        "case_id": ev.get("case_id"),
        "event_type": "memory_analysis",
        "title": "Memory Analysis Started",
        "description": f"Started Volatility 3 analysis on {ev.get('original_file_name')}",
        "event_time": datetime.utcnow().isoformat(),
        "created_by": current_user.id,
        "evidence_id": evidence_id
    }
    db.table("timeline_events").insert(timeline_event).execute()

    return MemoryAnalysisResponse(message="Memory analysis started in background", evidence_id=evidence_id)

@router.get("/{evidence_id}/results")
async def get_memory_analysis_results(
    evidence_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    db = get_supabase_admin()
    res = db.table("memory_analysis_results").select("*").eq("evidence_id", evidence_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="No memory analysis results found")
    
    return res.data[0]
