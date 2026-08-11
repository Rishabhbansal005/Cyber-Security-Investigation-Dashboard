from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import logging

from app.core.security import get_current_user, get_current_user_optional, CurrentUser
from app.core.supabase_client import get_supabase_admin
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["AI & Copilot"])
logger = logging.getLogger(__name__)

# Request Models
class OSINTSummaryRequest(BaseModel):
    indicator: str
    indicator_type: str
    otx_data: Optional[Dict[str, Any]] = None
    data_classification: str = Field("synthetic", description="synthetic | real_case_data")
    case_id: Optional[str] = None

class CyberCopilotRequest(BaseModel):
    question: str
    context: Optional[str] = None
    data_classification: str = Field("synthetic", description="synthetic | real_case_data")
    case_id: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = None

class CaseNarrativeRequest(BaseModel):
    case_title: str
    evidence_summary: str
    data_classification: str = Field("synthetic", description="synthetic | real_case_data")
    case_id: Optional[str] = None

class ApproveDraftRequest(BaseModel):
    audit_log_id: str

_VALID_STATUSES = {"success", "blocked", "failed", "rate_limited"}

def _normalize_status(status: str) -> str:
    """
    Map AI service status values to valid ai_audit_log CHECK constraint values:
    CHECK (response_status IN ('success', 'blocked', 'failed', 'rate_limited'))
    """
    if status in _VALID_STATUSES:
        return status
    if "block" in status or "offtopic" in status:
        return "blocked"
    if "fallback" in status or "success" in status:
        return "success"
    if "rate" in status or "429" in status:
        return "rate_limited"
    return "failed"

# Helper to log AI Audit record to Supabase
async def log_ai_audit(
    case_id: Optional[str],
    user_id: Optional[str],
    provider_used: str,
    data_classification: str,
    prompt_summary: str,
    response_status: str
) -> Optional[str]:
    try:
        db = get_supabase_admin()
        # Truncate and sanitize prompt summary (no PII, max 120 chars)
        sanitized_summary = prompt_summary.replace("\n", " ").strip()[:120]
        
        record = {
            "case_id": case_id,
            "user_id": user_id,
            "provider_used": provider_used,
            "data_classification": data_classification,
            "prompt_summary": sanitized_summary,
            "response_status": _normalize_status(response_status),
            "timestamp": datetime.utcnow().isoformat()
        }
        res = db.table("ai_audit_log").insert(record).execute()
        if res.data and len(res.data) > 0:
            return res.data[0].get("id")
    except Exception as e:
        logger.error(f"[AI AUDIT LOG ERROR] Failed to write to ai_audit_log: {e}")
    return None


@router.post("/osint-summary")
async def generate_osint_summary(
    req: OSINTSummaryRequest,
    current_user: CurrentUser = Depends(get_current_user_optional)
):
    """
    Generate AI Threat briefing for OSINT target with compliance gating.
    """
    ai_service = AIService()
    result = await ai_service.analyze_osint_indicator(
        indicator=req.indicator,
        indicator_type=req.indicator_type,
        otx_data=req.otx_data,
        data_classification=req.data_classification
    )

    provider_used = result.get("provider_used", f"{ai_service.ai_provider}:{ai_service.model_name}")
    status_code = result.get("status", "failed")
    
    audit_id = await log_ai_audit(
        case_id=req.case_id,
        user_id=current_user.id,
        provider_used=provider_used,
        data_classification=req.data_classification,
        prompt_summary=f"OSINT {req.indicator_type}: {req.indicator}",
        response_status=status_code
    )

    return {
        **result,
        "audit_log_id": audit_id,
        "review_status": "ai_draft",
        "disclaimer": "AI-Generated Draft — Not Verified. Requires officer review."
    }


@router.post("/chat")
async def chat_cyber_copilot(
    req: CyberCopilotRequest,
    current_user: CurrentUser = Depends(get_current_user_optional)
):
    """
    Ask CCID Cyber Copilot digital forensics assistant.
    """
    ai_service = AIService()
    result = await ai_service.ask_cyber_copilot(
        question=req.question,
        context=req.context,
        data_classification=req.data_classification,
        case_id=req.case_id,
        history=req.history
    )

    provider_used = result.get("provider_used", f"{ai_service.ai_provider}:{ai_service.model_name}")
    status_code = result.get("status", "failed")

    audit_id = await log_ai_audit(
        case_id=req.case_id,
        user_id=current_user.id,
        provider_used=provider_used,
        data_classification=req.data_classification,
        prompt_summary=f"Copilot Question: {req.question}",
        response_status=status_code
    )

    return {
        **result,
        "audit_log_id": audit_id,
        "review_status": "ai_draft",
        "disclaimer": "AI-Generated Draft — Not Verified. Requires officer review."
    }


@router.post("/case-narrative")
async def generate_case_narrative(
    req: CaseNarrativeRequest,
    current_user: CurrentUser = Depends(get_current_user_optional)
):

    """
    Generate formal legal case narrative for case reports.
    """
    ai_service = AIService()
    result = await ai_service.generate_case_narrative(
        case_title=req.case_title,
        evidence_summary=req.evidence_summary,
        data_classification=req.data_classification
    )

    provider_used = result.get("provider_used", f"{ai_service.ai_provider}:{ai_service.model_name}")
    status_code = result.get("status", "failed")

    audit_id = await log_ai_audit(
        case_id=req.case_id,
        user_id=current_user.id,
        provider_used=provider_used,
        data_classification=req.data_classification,
        prompt_summary=f"Case Narrative: {req.case_title}",
        response_status=status_code
    )

    return {
        **result,
        "audit_log_id": audit_id,
        "review_status": "ai_draft",
        "disclaimer": "AI-Generated Draft — Not Verified. Requires officer review."
    }


@router.post("/approve-draft")
async def approve_ai_draft(
    req: ApproveDraftRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Officer approval endpoint to mark AI-generated content as verified.
    """
    try:
        db = get_supabase_admin()
        res = db.table("ai_audit_log").update({
            "reviewed_by": current_user.id,
            "reviewed_at": datetime.utcnow().isoformat()
        }).eq("id", req.audit_log_id).execute()

        return {
            "success": True,
            "message": "AI Draft successfully approved and verified by officer.",
            "review_status": "officer_approved",
            "reviewed_by": current_user.id,
            "reviewed_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"[AI APPROVE DRAFT ERROR] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve AI draft: {str(e)}"
        )
