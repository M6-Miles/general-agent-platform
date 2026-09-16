import hashlib
import json
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.models import IdempotencyRecord


def request_hash(request: Request, payload: dict[str, Any]) -> str:
    canonical = json.dumps(
        {"method": request.method, "path": request.url.path, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def replay_or_reject(db: Session, *, tenant_id: str, key: str | None, fingerprint: str) -> dict[str, Any] | None:
    if not key:
        return None
    record = db.query(IdempotencyRecord).filter(
        IdempotencyRecord.tenant_id == tenant_id, IdempotencyRecord.key == key
    ).first()
    if record is None:
        return None
    if record.request_hash != fingerprint:
        raise HTTPException(status_code=409, detail="IDEMPOTENCY_KEY_REUSED")
    return record.response_json


def persist_response(
    db: Session,
    *,
    tenant_id: str,
    key: str | None,
    fingerprint: str,
    response_status: int,
    response_json: dict[str, Any],
    resource_type: str,
    resource_id: str,
) -> None:
    if not key:
        return
    db.add(IdempotencyRecord(
        tenant_id=tenant_id,
        key=key,
        request_hash=fingerprint,
        response_status=response_status,
        response_json=response_json,
        resource_type=resource_type,
        resource_id=resource_id,
    ))
