from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Run, RuntimeEvent


def record_runtime_event(
    db: Session,
    *,
    run: Run,
    event_type: str,
    payload: dict[str, Any] | None = None,
    retention_hours: int = 24,
) -> RuntimeEvent:
    """Append a durable, per-attempt event before the surrounding transaction commits."""
    # Serialize sequence allocation per run/attempt on databases supporting row locks.
    db.query(Run).filter(Run.id == run.id, Run.attempt_id == run.attempt_id).with_for_update().first()
    current = getattr(run, "_runtime_event_sequence", None)
    if current is None:
        current = db.query(func.max(RuntimeEvent.sequence)).filter(
            RuntimeEvent.run_id == run.id,
            RuntimeEvent.attempt_id == run.attempt_id,
        ).scalar()
    next_sequence = int(current or 0) + 1
    run._runtime_event_sequence = next_sequence
    event = RuntimeEvent(
        tenant_id=run.tenant_id,
        run_id=run.id,
        attempt_id=run.attempt_id,
        event_id=str(uuid4()),
        sequence=next_sequence,
        event_type=event_type,
        payload_json=payload or {},
        expires_at=datetime.now(UTC) + timedelta(hours=retention_hours),
    )
    db.add(event)
    return event
