"""Enforce tenant RLS and one workflow instance per Run."""

import sqlalchemy as sa
from alembic import op

revision = "v1c2d3e4f5a6"
down_revision = "u0b1c2d3e4f5"
branch_labels = None
depends_on = None

_TENANT_TABLES = (
    "users", "agents", "agent_versions", "runtime_snapshots", "vector_memories",
    "audit_events", "idempotency_records", "runs", "tool_definitions", "tool_calls",
    "workflow_nodes", "checkpoints", "approvals", "runtime_events", "tenant_quotas",
    "knowledge_bases", "knowledge_documents", "knowledge_chunks", "user_sessions",
    "tenant_quota_monthly", "workflow_instances", "skill_definitions",
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in _TENANT_TABLES:
            op.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
        op.execute(sa.text(
            "DELETE FROM workflow_instances WHERE id IN ("
            "SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY run_id ORDER BY created_at, id) AS position "
            "FROM workflow_instances WHERE run_id IS NOT NULL) duplicates WHERE position > 1)"
        ))
    else:
        op.execute(sa.text(
            "DELETE FROM workflow_instances WHERE run_id IS NOT NULL AND id NOT IN "
            "(SELECT min(id) FROM workflow_instances WHERE run_id IS NOT NULL GROUP BY run_id)"
        ))
    with op.batch_alter_table("workflow_instances") as batch_op:
        batch_op.create_unique_constraint("uq_workflow_instances_run_id", ["run_id"])


def downgrade() -> None:
    with op.batch_alter_table("workflow_instances") as batch_op:
        batch_op.drop_constraint("uq_workflow_instances_run_id", type_="unique")
    if op.get_bind().dialect.name == "postgresql":
        for table in reversed(_TENANT_TABLES):
            op.execute(sa.text(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY"))
