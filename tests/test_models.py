from app.audit import record_audit
from app.db import SessionLocal
from app.models import (
    AuditEvent,
    KnowledgeChunk,
    Run,
    Tenant,
    ToolCall,
    ToolDefinition,
    User,
    VectorMemory,
)


def test_embedding_storage_contract_uses_384_dimensions():
    assert "embedding_vector" in VectorMemory.__table__.c
    assert "embedding_vector" in KnowledgeChunk.__table__.c
    assert "embedding_model" in VectorMemory.__table__.c
    assert "embedding_generated_at" in KnowledgeChunk.__table__.c


def test_audit_contract_fields_are_written_and_readable():
    with SessionLocal() as db:
        tenant = Tenant(name="字段租户", slug="audit-fields")
        db.add(tenant)
        db.flush()
        user = User(tenant_id=tenant.id, email="audit-fields@example.com", display_name="审计用户", password_hash="hash")
        db.add(user)
        db.flush()
        record_audit(
            db,
            tenant_id=tenant.id,
            actor_id=user.id,
            action="test.audit",
            resource_type="user",
            resource_id=user.id,
            request_id="req-audit-fields",
            reason_code="test_reason",
            principal_type="user",
            metadata={"redacted": True},
        )
        db.commit()
        event = db.query(AuditEvent).filter_by(action="test.audit").one()
        assert event.event_id
        assert event.schema_version == 1
        assert event.correlation_id == "req-audit-fields"
        assert event.metadata_redacted == {"redacted": True}


def test_record_audit_redacts_sensitive_metadata_recursively():
    with SessionLocal() as db:
        tenant = Tenant(name="Audit Redaction Tenant", slug="audit-redaction")
        db.add(tenant)
        db.flush()
        record_audit(
            db,
            tenant_id=tenant.id,
            actor_id=None,
            action="test.audit_redaction",
            resource_type="tenant",
            resource_id=tenant.id,
            request_id="req-audit-redaction",
            metadata={
                "api_key": "sk-must-not-survive",
                "nested": {"password": "plain-secret"},
                "message": "Bearer abcdefghijklmnop",
            },
        )
        db.commit()
        event = db.query(AuditEvent).filter_by(action="test.audit_redaction").one()
        assert event.metadata_redacted == {
            "api_key": "***REDACTED***",
            "nested": {"password": "***REDACTED***"},
            "message": "Bearer ***REDACTED***",
        }


def test_run_and_tool_call_contract_fields_have_defaults():
    with SessionLocal() as db:
        tenant = Tenant(name="运行租户", slug="run-fields")
        db.add(tenant)
        db.flush()
        user = User(tenant_id=tenant.id, email="run-fields@example.com", display_name="运行用户", password_hash="hash")
        db.add(user)
        db.flush()
        agent_id = "agent-contract-fields"
        from app.models import Agent
        agent = Agent(id=agent_id, tenant_id=tenant.id, name="字段代理", created_by=user.id, updated_by=user.id)
        db.add(agent)
        db.flush()
        run = Run(tenant_id=tenant.id, agent_id=agent.id, created_by=user.id)
        db.add(run)
        db.flush()
        tool = ToolDefinition(tenant_id=tenant.id, name="字段工具", executor="noop", created_by=user.id)
        db.add(tool)
        db.flush()
        call = ToolCall(tenant_id=tenant.id, run_id=run.id, tool_definition_id=tool.id, idempotency_key="contract-fields-key")
        db.add(call)
        db.commit()
        assert run.conversation_id and run.attempt_id
        assert call.attempt_id and call.tool_version == 1
