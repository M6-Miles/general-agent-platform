from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent
from app.security_utils import redact_json


def record_audit(
    db: Session, *, tenant_id: str, actor_id: str | None, action: str,
    resource_type: str, resource_id: str, request_id: str, metadata: dict[str, Any] | None = None,
    outcome: str = "success",
    principal_type: str = "user", reason_code: str = "",
    correlation_id: str | None = None, ip_hash: str | None = None,
    user_agent_hash: str | None = None,
) -> None:
    safe_metadata = redact_json(metadata or {})
    db.add(AuditEvent(
        tenant_id=tenant_id, actor_id=actor_id, action=action,
        resource_type=resource_type, resource_id=resource_id, request_id=request_id,
        metadata_json=safe_metadata, outcome=outcome,
        metadata_redacted=safe_metadata, principal_type=principal_type,
        reason_code=reason_code, correlation_id=correlation_id or request_id,
        ip_hash=ip_hash, user_agent_hash=user_agent_hash,
    ))
