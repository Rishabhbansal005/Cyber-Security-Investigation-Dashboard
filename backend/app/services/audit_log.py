"""Write officer actions to officer_audit_log. Never raise to the caller."""
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def write_officer_audit(
    db,
    *,
    action: str,
    target: str,
    officer_id: Optional[str] = None,
    officer_email: Optional[str] = None,
    status: str = "logged",
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    try:
        payload = {
            "action": action,
            "target": target,
            "officer_id": officer_id,
            "officer_email": officer_email,
            "status": status,
            "metadata": metadata or {},
        }
        db.table("officer_audit_log").insert(payload).execute()
    except Exception as exc:
        logger.warning("officer_audit_log write skipped: %s", exc)
