import uuid
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.core.security import get_current_user, CurrentUser
from app.core.supabase_client import get_supabase_admin
from app.models.schemas import UsbAnalysisResult
from app.services.usb_parser import UsbParser
import logging

router = APIRouter(prefix="/forensics/usb", tags=["USB Analysis"])
logger = logging.getLogger(__name__)

async def analyze_usb_artifacts_task(evidence_id: str, case_id: str, current_user: CurrentUser):
    db = get_supabase_admin()
    
    record_id = str(uuid.uuid4())
    record = {
        "id": record_id,
        "evidence_id": evidence_id,
        "analysis_status": "analyzing",
        "connected_devices": [],
        "suspicious_devices": [],
        "analysis_summary": {}
    }
    
    try:
        db.table("usb_analysis_results").insert(record).execute()
        
        evidence_res = db.table("evidence").select("*").eq("id", evidence_id).execute()
        if not evidence_res.data:
            raise Exception("Evidence not found")
            
        evidence = evidence_res.data[0]
        
        original_file_name = evidence.get("original_file_name", "").lower()
        file_path = evidence.get("storage_path") or ""
        
        parsed_data = {"connected_devices": [], "suspicious_devices": []}
        lnk_data = {"file_transfers": [], "suspicious_transfers": []}
        
        import httpx
        import tempfile
        import os
        
        # Download the file from Supabase Storage
        url_res = db.storage.from_(evidence.get("storage_bucket", "forensic_uploads")).create_signed_url(file_path, 3600)
        signed_url = url_res.get("signedURL")
        
        if not signed_url:
            raise Exception(f"Could not generate signed URL for {file_path}")
            
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
            async with httpx.AsyncClient() as client:
                async with client.stream("GET", signed_url) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
                        tmp.write(chunk)
                        
        try:
            # Branch logic based on file type
            if original_file_name.endswith(".lnk"):
                lnk_data = UsbParser.parse_lnk_file(tmp_path, original_file_name)
            else:
                parsed_data = UsbParser.parse_system_hive(tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        
        summary = {
            "total_devices": len(parsed_data["connected_devices"]),
            "suspicious_devices_count": len(parsed_data["suspicious_devices"]),
            "file_transfers": len(lnk_data["file_transfers"]),
            "suspicious_transfers": len(lnk_data["suspicious_transfers"])
        }
        
        update_data = {
            "analysis_status": "completed",
            "connected_devices": parsed_data["connected_devices"],
            "suspicious_devices": parsed_data["suspicious_devices"] + lnk_data["suspicious_transfers"],
            "analysis_summary": summary
        }
        
        db.table("usb_analysis_results").update(update_data).eq("id", record_id).execute()
        
        events = []
        for dev in parsed_data["connected_devices"]:
            events.append({
                "case_id": case_id,
                "evidence_id": evidence_id,
                "event_time": dev.get("first_connected", "now()"),
                "title": f"USB Device Connected: {dev.get('vendor', '')} {dev.get('product', '')}",
                "description": f"Serial: {dev.get('serial_number', '')}",
                "event_type": "system",
                "importance": "informational",
                "is_confirmed": True,
                "source": "USB Analysis",
                "tags": ["usb", "hardware"],
                "raw_data": dev,
                "created_by": current_user.id
            })
            
        for susp in parsed_data["suspicious_devices"] + lnk_data["suspicious_transfers"]:
            title = f"Suspicious USB Device: {susp.get('vendor')}" if "vendor" in susp else f"Data Exfiltration Indicator: {susp.get('file_name')}"
            desc = f"Serial: {susp.get('serial_number')}. Reason: {susp.get('reason')}" if "vendor" in susp else f"Target: {susp.get('target_path')}. Reason: {susp.get('reason')}"
            finding = {
                "case_id": case_id,
                "evidence_id": evidence_id,
                "finding_number": f"FND-USB-{str(uuid.uuid4())[:8].upper()}",
                "title": title,
                "description": desc,
                "severity": susp.get("severity", "high"),
                "category": "usb" if "vendor" in susp else "data_exfiltration",
                "status": "open",
                "tags": ["usb", "suspicious"] if "vendor" in susp else ["exfiltration", "usb", "file_transfer"],
                "ioc_indicators": [{"type": "filename", "value": susp.get("target_path", "")}] if "target_path" in susp else [],
                "analysis_source": "USB Analysis",
                "created_by": current_user.id
            }
            finding_res = db.table("findings").insert(finding).execute()
            
            if finding_res.data:
                finding_id = finding_res.data[0]["id"]
                events.append({
                    "case_id": case_id,
                    "evidence_id": evidence_id,
                    "finding_id": finding_id,
                    "event_time": "now()",
                    "title": title,
                    "description": desc,
                    "event_type": "finding",
                    "importance": susp.get("severity", "high"),
                    "is_confirmed": True,
                    "source": "USB Analysis",
                    "tags": ["usb", "suspicious"],
                    "raw_data": susp,
                    "created_by": current_user.id
                })

        for transfer in lnk_data["file_transfers"]:
            events.append({
                "case_id": case_id,
                "evidence_id": evidence_id,
                "event_time": transfer.get("accessed_time", "now()"),
                "title": f"File Transfer via USB: {transfer.get('target_path', transfer.get('file_name'))}",
                "description": f"File was accessed/transferred to removable media. Type: {transfer.get('drive_type')}",
                "event_type": "file",
                "importance": "medium" if transfer.get("is_usb") else "informational",
                "is_confirmed": True,
                "source": "USB Analysis",
                "tags": ["usb", "file_transfer"],
                "raw_data": transfer,
                "created_by": current_user.id
            })
                
        if events:
            db.table("timeline_events").insert(events).execute()
            
        db.table("evidence").update({"processing_status": "analyzed"}).eq("id", evidence_id).execute()
        
        # Trigger correlation engine which will also update risk
        from app.services.correlation_engine import generate_correlations_for_case
        generate_correlations_for_case(case_id, current_user.id)
        
        logger.info(f"USB artifact analysis completed for {evidence_id}")
            
    except Exception as e:
        logger.error(f"USB analysis error: {e}")
        db.table("usb_analysis_results").update({
            "analysis_status": "failed",
            "error_message": str(e)
        }).eq("id", record_id).execute()
        db.table("evidence").update({"processing_status": "error"}).eq("id", evidence_id).execute()


@router.post("/analyze/{evidence_id}")
async def start_usb_analysis(
    evidence_id: str,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user)
):
    try:
        db = get_supabase_admin()
        res = db.table("evidence").select("case_id").eq("id", evidence_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Evidence not found")
            
        case_id = res.data[0]["case_id"]
        background_tasks.add_task(analyze_usb_artifacts_task, evidence_id, case_id, current_user)
        return {"message": "USB analysis started in the background"}
    except Exception as e:
        logger.error(f"Error starting USB analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{evidence_id}", response_model=UsbAnalysisResult)
async def get_usb_analysis(
    evidence_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    try:
        db = get_supabase_admin()
        res = db.table("usb_analysis_results").select("*").eq("evidence_id", evidence_id).order("created_at", desc=True).limit(1).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="No USB analysis found for this evidence")
            
        return res.data[0]
    except Exception as e:
        logger.error(f"Error fetching USB analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))
