import logging
import os
import tempfile
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import require_investigator, CurrentUser
from app.core.supabase_client import get_supabase_admin
from app.services.forensics.image_parser import ImageParser

router = APIRouter(prefix="/image", tags=["Image Forensics"])
logger = logging.getLogger(__name__)

@router.post("/{evidence_id}/analyze", response_model=Dict[str, Any])
async def analyze_image_evidence(
    evidence_id: str,
    current_user: CurrentUser = Depends(require_investigator)
):
    """Analyze an uploaded image file for EXIF and GPS data."""
    try:
        db = get_supabase_admin()

        # 1. Get Evidence Record
        result = db.table("evidence").select("*").eq("id", evidence_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Evidence not found")
            
        evidence = result.data
        if evidence.get("processing_status") == "completed" and evidence.get("analysis_results"):
            return evidence["analysis_results"]

        db.table("evidence").update({"processing_status": "processing"}).eq("id", evidence_id).execute()

        # 2. Download file locally to temp dir
        try:
            storage_path = evidence["storage_path"]
            bucket = evidence["storage_bucket"]
            
            # Use signed url for download
            url_result = db.storage.from_(bucket).create_signed_url(storage_path, 3600)
            if not url_result or not url_result.get("signedURL"):
                raise HTTPException(status_code=500, detail="Failed to get download URL")
                
            download_url = url_result.get("signedURL")
            
            import httpx
            with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
                temp_path = tmp_file.name
                async with httpx.AsyncClient() as client:
                    async with client.stream('GET', download_url) as response:
                        response.raise_for_status()
                        for chunk in response.aiter_bytes():
                            tmp_file.write(chunk)
                            
        except Exception as e:
            logger.error(f"Failed to download evidence for analysis: {e}")
            db.table("evidence").update({"processing_status": "failed"}).eq("id", evidence_id).execute()
            raise HTTPException(status_code=500, detail="Failed to download file for analysis")

        # 3. Analyze Image
        try:
            analysis_results = ImageParser.parse_image(temp_path, evidence["original_file_name"])
        except Exception as e:
            logger.error(f"Failed to parse Image: {e}")
            db.table("evidence").update({"processing_status": "failed"}).eq("id", evidence_id).execute()
            raise HTTPException(status_code=500, detail="Failed to parse Image")
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
        # 4. Save Timeline Events
        timeline_events = analysis_results.get("timeline_events", [])
        if timeline_events:
            timeline_payloads = []
            for ev in timeline_events:
                timeline_payloads.append({
                    "case_id": evidence["case_id"],
                    "evidence_id": evidence_id,
                    "event_time": ev["timestamp"],
                    "title": "Image EXIF Event",
                    "description": ev["description"],
                    "event_type": "evidence",
                    "importance": "normal",
                    "created_by": current_user.id
                })
            
            # Insert in chunks to avoid large payload errors
            for i in range(0, len(timeline_payloads), 100):
                chunk = timeline_payloads[i:i+100]
                db.table("timeline_events").insert(chunk).execute()

        # 5. Update Evidence Record
        db.table("evidence").update({
            "processing_status": "completed",
            "analysis_results": analysis_results
        }).eq("id", evidence_id).execute()

        # Update case timestamps
        from datetime import datetime
        db.table("cases").update({
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", evidence["case_id"]).execute()

        return analysis_results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image analysis error for {evidence_id}: {e}")
        db.table("evidence").update({"processing_status": "failed"}).eq("id", evidence_id).execute()
        raise HTTPException(status_code=500, detail=str(e))
