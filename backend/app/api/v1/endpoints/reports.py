from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from fastapi.responses import StreamingResponse
import io
from app.core.security import get_current_user, require_investigator, CurrentUser
from app.core.supabase_client import get_supabase_admin
from app.core.config import settings
from app.models.schemas import ReportCreate, ReportResponse, MessageResponse
from app.services.report_service import generate_case_report
from app.services.ppt_service import generate_case_ppt
import logging

router = APIRouter(prefix="/reports", tags=["Reports"])
logger = logging.getLogger(__name__)


async def _generate_report_task(report_id: str, case_id: str, config: dict, investigator_id: str):
    """Background task to generate PDF report and upload to Supabase Storage."""
    db = get_supabase_admin()
    try:
        # Fetch all data
        case = db.table("cases").select("*").eq("id", case_id).single().execute().data
        evidence = db.table("evidence").select("*").eq("case_id", case_id).execute().data or []
        findings = db.table("findings").select("*").eq("case_id", case_id).order("severity").execute().data or []
        timeline = db.table("timeline_events").select("*").eq("case_id", case_id).order("event_time").execute().data or []
        risk_result = db.table("risk_assessments").select("*").eq("case_id", case_id).execute()
        risk = risk_result.data[0] if risk_result.data else None
        investigator_result = db.table("users").select("*").eq("id", investigator_id).execute()
        investigator = investigator_result.data[0] if investigator_result.data else {}
        
        memory_results = []
        evidence_ids = [e["id"] for e in evidence]
        if evidence_ids:
            mem_res = db.table("memory_analysis_results").select("*").in_("evidence_id", evidence_ids).execute()
            memory_results = mem_res.data or []
            
        correlations_res = db.table("correlations").select("*").eq("case_id", case_id).execute()
        correlations = correlations_res.data or []

        # Generate PDF or PPT
        report_format = config.get("report_format", "pdf")
        if report_format == "ppt":
            file_bytes = generate_case_ppt(
                case=case,
                evidence_list=evidence,
                findings=findings,
                timeline_events=timeline,
                risk_assessment=risk,
                investigator=investigator,
                config=config,
            )
            file_ext = "pptx"
            content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        else:
            file_bytes = generate_case_report(
                case=case,
                evidence_list=evidence,
                findings=findings,
                timeline_events=timeline,
                risk_assessment=risk,
                investigator=investigator,
                config=config,
                memory_results=memory_results,
                correlations=correlations,
            )
            file_ext = "pdf"
            content_type = "application/pdf"

        # Upload to storage — use a consistent bucket and persist it to the record
        upload_bucket = settings.storage_bucket or "forensic_uploads"
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        storage_path = f"cases/{case_id}/reports/{report_id}_{timestamp}.{file_ext}"
        db.storage.from_(upload_bucket).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": content_type},
        )

        # Update report record — persist the exact bucket used so download matches
        db.table("reports").update({
            "status": "ready",
            "storage_path": storage_path,
            "storage_bucket": upload_bucket,
            "file_size": len(file_bytes),
            "generated_at": datetime.utcnow().isoformat(),
        }).eq("id", report_id).execute()

        logger.info(f"Report {report_id} generated successfully ({len(file_bytes)} bytes)")

    except Exception as e:
        logger.error(f"Report generation failed for {report_id}: {e}")
        db.table("reports").update({
            "status": "failed",
            "error_message": str(e),
        }).eq("id", report_id).execute()


@router.get("/case/{case_id}", response_model=list[ReportResponse])
async def list_reports(
    case_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        db = get_supabase_admin()
        result = db.table("reports").select("*").eq("case_id", case_id).order("created_at", desc=True).execute()
        return result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/65b/{evidence_id}")
async def generate_65b_cert(
    evidence_id: str,
    current_user: CurrentUser = Depends(require_investigator)
):
    """Generate and return a Section 65B Certificate for a specific evidence item."""
    try:
        db = get_supabase_admin()
        
        ev_result = db.table("evidence").select("*").eq("id", evidence_id).single().execute()
        if not ev_result.data:
            raise HTTPException(status_code=404, detail="Evidence not found")
        evidence = ev_result.data
        
        case_result = db.table("cases").select("*").eq("id", evidence["case_id"]).single().execute()
        if not case_result.data:
            raise HTTPException(status_code=404, detail="Case not found")
        case = case_result.data
        
        inv_result = db.table("users").select("*").eq("id", current_user.id).single().execute()
        investigator = inv_result.data or {"full_name": current_user.email, "role": current_user.role}
        
        from app.services.report_service import generate_65b_certificate
        pdf_bytes = generate_65b_certificate(evidence, case, investigator)
        
        filename = f"Section_65B_{evidence.get('evidence_number', evidence_id)}.pdf"
        
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"65B Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=ReportResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_report(
    report_data: ReportCreate,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(require_investigator),
):
    """Trigger PDF report generation (runs in background)."""
    try:
        db = get_supabase_admin()
        payload = {
            "case_id": report_data.case_id,
            "title": report_data.title,
            "report_type": report_data.report_type,
            "status": "generating",
            "include_executive_summary": report_data.include_executive_summary,
            "include_timeline": report_data.include_timeline,
            "include_findings": report_data.include_findings,
            "include_evidence_list": report_data.include_evidence_list,
            "include_risk_assessment": report_data.include_risk_assessment,
            "generated_by": current_user.id,
        }
        result = db.table("reports").insert(payload).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create report record")

        report = result.data[0]
        config = {
            "include_executive_summary": report_data.include_executive_summary,
            "include_timeline": report_data.include_timeline,
            "include_findings": report_data.include_findings,
            "include_evidence_list": report_data.include_evidence_list,
            "include_risk_assessment": report_data.include_risk_assessment,
            "report_format": report_data.report_format,
        }

        background_tasks.add_task(
            _generate_report_task,
            report_id=report["id"],
            case_id=report_data.case_id,
            config=config,
            investigator_id=current_user.id,
        )

        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{report_id}/download")
async def download_report(
    report_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a signed download URL for a report PDF."""
    try:
        db = get_supabase_admin()
        report = db.table("reports").select("*").eq("id", report_id).single().execute().data
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        if report["status"] != "ready":
            raise HTTPException(status_code=425, detail=f"Report is not ready yet (status: {report['status']})")

        url = db.storage.from_(report["storage_bucket"] or settings.storage_bucket).create_signed_url(
            path=report["storage_path"],
            expires_in=3600,
        )
        return {"download_url": url.get("signedURL"), "expires_in": 3600, "title": report["title"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{report_id}", response_model=MessageResponse)
async def delete_report(
    report_id: str,
    current_user: CurrentUser = Depends(require_investigator),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        db = get_supabase_admin()
        db.table("reports").delete().eq("id", report_id).execute()
        return MessageResponse(message="Report deleted")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
