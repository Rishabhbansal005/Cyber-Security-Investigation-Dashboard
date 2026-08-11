import logging
import os
import tempfile
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.security import require_investigator, CurrentUser
from app.core.supabase_client import get_supabase_admin
from app.services.forensics.financial_parser import FinancialParser
from app.services.forensics.crypto_tracker import CryptoTracker

router = APIRouter(prefix="/financial", tags=["Financial Tracing"])
logger = logging.getLogger(__name__)

@router.post("/{evidence_id}/analyze", response_model=Dict[str, Any])
async def analyze_financial_evidence(
    evidence_id: str,
    current_user: CurrentUser = Depends(require_investigator)
):
    """Analyze an uploaded bank statement CSV file."""
    try:
        db = get_supabase_admin()

        result = db.table("evidence").select("*").eq("id", evidence_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Evidence not found")
            
        evidence = result.data
        if evidence.get("processing_status") == "completed" and evidence.get("analysis_results"):
            return evidence["analysis_results"]

        db.table("evidence").update({"processing_status": "processing"}).eq("id", evidence_id).execute()

        try:
            storage_path = evidence["storage_path"]
            bucket = evidence["storage_bucket"]
            
            url_result = db.storage.from_(bucket).create_signed_url(storage_path, 3600)
            if not url_result or not url_result.get("signedURL"):
                raise HTTPException(status_code=500, detail="Failed to get download URL")
                
            download_url = url_result.get("signedURL")
            
            import httpx
            with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp_file:
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

        try:
            analysis_results = FinancialParser.parse_statement(temp_path, evidence["original_file_name"])
        except Exception as e:
            logger.error(f"Failed to parse statement: {e}")
            db.table("evidence").update({"processing_status": "failed"}).eq("id", evidence_id).execute()
            raise HTTPException(status_code=500, detail="Failed to parse statement")
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
        # Update Evidence Record
        db.table("evidence").update({
            "processing_status": "completed",
            "analysis_results": analysis_results
        }).eq("id", evidence_id).execute()

        from datetime import datetime
        db.table("cases").update({
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", evidence["case_id"]).execute()

        return analysis_results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Financial analysis error for {evidence_id}: {e}")
        db.table("evidence").update({"processing_status": "failed"}).eq("id", evidence_id).execute()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/crypto/trace")
async def trace_crypto(
    address: str = Query(..., description="The crypto address to trace"),
    coin: str = Query("btc", description="The coin symbol (e.g., btc, eth)"),
    current_user: CurrentUser = Depends(require_investigator)
):
    """Trace a cryptocurrency address using public block explorer APIs."""
    try:
        result = await CryptoTracker.trace_address(address, coin)
        return result
    except Exception as e:
        logger.error(f"Crypto trace error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
