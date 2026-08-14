import logging
from typing import List

from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, get_current_user
from app.core.supabase_client import get_supabase_admin

router = APIRouter(prefix="/audit", tags=["Audit"])
logger = logging.getLogger(__name__)


@router.get("/logs")
async def list_audit_logs(current_user: CurrentUser = Depends(get_current_user)) -> List[dict]:
    try:
        db = get_supabase_admin()
        res = (
            db.table("officer_audit_log")
            .select("*")
            .order("created_at", desc=True)
            .limit(200)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.warning("Audit log list unavailable (run migration 018): %s", e)
        return []
