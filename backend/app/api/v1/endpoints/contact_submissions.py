"""
POST /api/v1/contact  — validate, store, email notify.
GET  /api/v1/contact  — list recent tickets (signed-in officers).
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import get_current_user, CurrentUser
from app.core.supabase_client import get_supabase_admin
from app.services.email_service import send_contact_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contact", tags=["Contact"])

_BACKEND_ROOT = Path(__file__).resolve().parents[4]
_FALLBACK_FILE = _BACKEND_ROOT / "data" / "contact_submissions.jsonl"


class ContactSubmissionRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    subject: str = Field(..., min_length=2, max_length=120)
    message: str = Field(..., min_length=10, max_length=2000)

    @field_validator("name", "subject", "message", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v

    @field_validator("name")
    @classmethod
    def no_script_tags(cls, v: str) -> str:
        if "<" in v or ">" in v:
            raise ValueError("Name must not contain HTML tags")
        return v


class ContactSubmissionResponse(BaseModel):
    success: bool
    message: str
    submission_id: Optional[str] = None
    emailed: bool = False


def _save_local(row: dict[str, Any]) -> None:
    _FALLBACK_FILE.parent.mkdir(parents=True, exist_ok=True)
    with _FALLBACK_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def _read_local(limit: int = 50) -> list[dict[str, Any]]:
    if not _FALLBACK_FILE.exists():
        return []
    lines = _FALLBACK_FILE.read_text(encoding="utf-8").splitlines()
    rows: list[dict[str, Any]] = []
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
        if len(rows) >= limit:
            break
    return rows


@router.post(
    "",
    response_model=ContactSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(settings.rate_limit_contact)
async def submit_contact_form(
    request: Request,
    body: ContactSubmissionRequest,
) -> ContactSubmissionResponse:
    client_ip = request.client.host if request.client else "unknown"
    user_agent = (request.headers.get("user-agent") or "unknown")[:500]
    now = datetime.now(timezone.utc).isoformat()
    submission_id = str(uuid4())

    submission_data = {
        "id": submission_id,
        "name": body.name,
        "email": str(body.email),
        "subject": body.subject,
        "message": body.message,
        "ip_address": client_ip,
        "user_agent": user_agent,
        "created_at": now,
    }

    stored = False
    try:
        _save_local(submission_data)
        stored = True
        logger.info("Contact saved locally id=%s from %s", submission_id, body.email)
    except Exception as exc:
        logger.error("Local contact store failed: %s", exc)

    try:
        db = get_supabase_admin()
        result = db.table("contact_submissions").insert({
            "id": submission_id,
            "name": body.name,
            "email": str(body.email),
            "subject": body.subject,
            "message": body.message,
            "ip_address": client_ip,
            "user_agent": user_agent,
        }).execute()
        if result.data:
            stored = True
            submission_id = result.data[0].get("id") or submission_id
            logger.info("Contact saved to database id=%s from %s", submission_id, body.email)
    except Exception as exc:
        logger.warning("Supabase contact insert failed (%s).", exc)

    if not stored:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save your message. Please try again later.",
        )

    emailed = False
    try:
        emailed = bool(await send_contact_notification(submission_data))
    except Exception as exc:
        logger.error("Email notification error (non-fatal): %s", exc)

    return ContactSubmissionResponse(
        success=True,
        message=(
            "Your message is in the support queue. "
            + ("A notification email was sent." if emailed else "An officer can review it in Contact & Support.")
        ),
        submission_id=submission_id,
        emailed=emailed,
    )


@router.get("")
async def list_contact_submissions(
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Recent support tickets for signed-in officers."""
    rows: list[dict[str, Any]] = []
    try:
        db = get_supabase_admin()
        result = (
            db.table("contact_submissions")
            .select("id,name,email,subject,message,created_at")
            .order("created_at", desc=True)
            .limit(30)
            .execute()
        )
        rows = result.data or []
    except Exception as exc:
        logger.warning("Could not list contact_submissions from database: %s", exc)
        rows = _read_local(30)

    return {"items": rows, "viewer": current_user.email}
