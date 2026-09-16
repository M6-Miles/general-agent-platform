from uuid import uuid4

import pytest
from sqlalchemy.exc import DatabaseError

from app.audit import record_audit
from app.db import SessionLocal
from app.models import AuditEvent, Tenant, User


def create_audit_event(db):
    suffix = uuid4().hex
    tenant = Tenant(name=f"Audit Tenant {suffix}", slug=f"audit-{suffix}")
    db.add(tenant)
    db.flush()
    user = User(
        tenant_id=tenant.id,
        email=f"audit-{suffix}@example.com",
        display_name="Audit User",
        role="tenant_admin",
        password_hash="not-used",
    )
    db.add(user)
    db.flush()
    record_audit(
        db,
        tenant_id=tenant.id,
        actor_id=user.id,
        action="audit.tested",
        resource_type="test",
        resource_id=suffix,
        request_id=f"test-{suffix}",
    )
    db.commit()
    return db.query(AuditEvent).filter_by(resource_id=suffix).one()


def test_audit_event_update_is_rejected():
    with SessionLocal() as db:
        audit = create_audit_event(db)
        audit.action = "audit.modified"
        with pytest.raises(DatabaseError, match="audit_events are immutable"):
            db.commit()
        db.rollback()


def test_audit_event_delete_is_rejected():
    with SessionLocal() as db:
        audit = create_audit_event(db)
        db.delete(audit)
        with pytest.raises(DatabaseError, match="audit_events are immutable"):
            db.commit()
        db.rollback()
