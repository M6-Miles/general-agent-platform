"""Enable PostgreSQL row-level tenant isolation for every tenant table."""

import sqlalchemy as sa
from alembic import op

revision = "t9a0b1c2d3e4"
down_revision = "s8d9e0f1a2b3"
branch_labels = None
depends_on = None

# Keep this list explicit so migration review can verify the security boundary.
_TENANT_TABLES = (
    "users",
    "agents",
    "agent_versions",
    "runtime_snapshots",
    "vector_memories",
    "audit_events",
    "idempotency_records",
    "runs",
    "tool_definitions",
    "tool_calls",
    "workflow_nodes",
    "checkpoints",
    "approvals",
    "runtime_events",
    "tenant_quotas",
    "tenant_quota_monthly",
    "knowledge_bases",
    "knowledge_documents",
    "knowledge_chunks",
    "workflow_instances",
    "skill_definitions",
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    for table in _TENANT_TABLES:
        policy = f"tenant_isolation_{table}"
        op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS {policy} ON {table}"))
        op.execute(
            sa.text(
                f"CREATE POLICY {policy} ON {table} "
                "USING (tenant_id = current_setting('app.tenant_id', true)) "
                "WITH CHECK (tenant_id = current_setting('app.tenant_id', true))"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    for table in reversed(_TENANT_TABLES):
        policy = f"tenant_isolation_{table}"
        op.execute(sa.text(f"DROP POLICY IF EXISTS {policy} ON {table}"))
        op.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
