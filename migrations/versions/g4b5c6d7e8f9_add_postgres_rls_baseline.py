"""add optional PostgreSQL tenant RLS baseline"""
import sqlalchemy as sa
from alembic import op

revision = "g4b5c6d7e8f9"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None

_TENANT_TABLES = ("users", "agents", "agent_versions", "runtime_snapshots", "vector_memories", "audit_events", "idempotency_records", "runs", "tool_definitions", "tool_calls", "workflow_nodes", "checkpoints", "approvals", "runtime_events", "tenant_quotas")


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    for table in _TENANT_TABLES:
        policy = f"tenant_isolation_{table}"
        op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS {policy} ON {table}"))
        op.execute(sa.text(f"CREATE POLICY {policy} ON {table} USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true))"))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    for table in reversed(_TENANT_TABLES):
        op.execute(sa.text(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}"))
        op.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
