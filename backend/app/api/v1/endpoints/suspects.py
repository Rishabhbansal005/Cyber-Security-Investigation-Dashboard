import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.security import get_current_user, require_investigator, CurrentUser
from app.core.supabase_client import get_supabase_admin
from app.models.schemas import SuspectCreate, SuspectUpdate, SuspectResponse, MessageResponse
from app.services.audit_log import write_officer_audit

router = APIRouter(prefix="/suspects", tags=["Suspects"])
logger = logging.getLogger(__name__)

@router.post("/", response_model=SuspectResponse, status_code=status.HTTP_201_CREATED)
async def create_suspect(
    suspect_in: SuspectCreate,
    current_user: CurrentUser = Depends(require_investigator)
):
    """Create a new suspect."""
    try:
        db = get_supabase_admin()
        
        payload = suspect_in.model_dump()
        payload["created_by"] = current_user.id

        try:
            result = db.table("suspects").insert(payload).execute()
        except Exception as insert_err:
            logger.warning("Suspect insert with ops fields failed, retrying core columns: %s", insert_err)
            payload.pop("status", None)
            payload.pop("funds_linked_inr", None)
            result = db.table("suspects").insert(payload).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create suspect")

        created = result.data[0]
        write_officer_audit(
            db,
            action="ADD_SUSPECT",
            target=created.get("name"),
            officer_id=current_user.id,
            officer_email=current_user.email,
            status="logged",
        )
        return created
    except Exception as e:
        logger.error(f"Error creating suspect: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/case/{case_id}", response_model=List[SuspectResponse])
async def list_suspects_for_case(
    case_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """List all suspects for a case."""
    try:
        db = get_supabase_admin()
        result = db.table("suspects").select("*").eq("case_id", case_id).order("created_at", desc=True).execute()
        return result.data or []
    except Exception as e:
        logger.error(f"Error listing suspects for case {case_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{suspect_id}", response_model=SuspectResponse)
async def get_suspect(
    suspect_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get a suspect by ID."""
    try:
        db = get_supabase_admin()
        result = db.table("suspects").select("*").eq("id", suspect_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Suspect not found")
        return result.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{suspect_id}", response_model=SuspectResponse)
async def update_suspect(
    suspect_id: str,
    suspect_in: SuspectUpdate,
    current_user: CurrentUser = Depends(require_investigator)
):
    """Update a suspect."""
    try:
        db = get_supabase_admin()
        payload = suspect_in.model_dump(exclude_none=True)
        
        if not payload:
            result = db.table("suspects").select("*").eq("id", suspect_id).single().execute()
            if not result.data:
                raise HTTPException(status_code=404, detail="Suspect not found")
            return result.data
            
        result = db.table("suspects").update(payload).eq("id", suspect_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Suspect not found")
        updated = result.data[0]
        if payload.get("status") == "arrested":
            write_officer_audit(
                db,
                action="MARK_ARRESTED",
                target=updated.get("name"),
                officer_id=current_user.id,
                officer_email=current_user.email,
                status="logged",
            )
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{suspect_id}", response_model=MessageResponse)
async def delete_suspect(
    suspect_id: str,
    current_user: CurrentUser = Depends(require_investigator)
):
    """Delete a suspect."""
    try:
        db = get_supabase_admin()
        result = db.table("suspects").delete().eq("id", suspect_id).execute()
        
        # In PostgREST, delete doesn't always return the deleted row unless requested,
        # but if it succeeds without error, we consider it deleted.
        return MessageResponse(message="Suspect deleted successfully")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
