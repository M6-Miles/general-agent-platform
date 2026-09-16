"""add runtime snapshots and usage fields

Revision ID: f1a2b3c4d5e6
Revises: c4f8c31f7a12
"""

import sqlalchemy as sa
from alembic import op

revision = "f1a2b3c4d5e6"
down_revision = "c4f8c31f7a12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("snapshot_id", sa.String(length=100), nullable=True))
    op.add_column("runs", sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("runs", sa.Column("usage_json", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("runs", sa.Column("cost_usd", sa.Float(), nullable=False, server_default="0"))
    op.add_column("runs", sa.Column("budget_json", sa.JSON(), nullable=False, server_default="{}"))
    op.create_index("ix_runs_snapshot_id", "runs", ["snapshot_id"])
    op.add_column("checkpoints", sa.Column("attempt_id", sa.String(length=100), nullable=True))
    op.add_column("checkpoints", sa.Column("snapshot_id", sa.String(length=100), nullable=True))
    op.add_column("checkpoints", sa.Column("usage_json", sa.JSON(), nullable=False, server_default="{}"))
    op.create_index("ix_checkpoints_snapshot_id", "checkpoints", ["snapshot_id"])
    op.create_table(
        "runtime_snapshots",
        sa.Column("id", sa.String(length=100), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("run_id", sa.String(length=100), nullable=False),
        sa.Column("agent_id", sa.String(length=100), nullable=False),
        sa.Column("agent_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("definition_json", sa.JSON(), nullable=False),
        sa.Column("tool_policies_json", sa.JSON(), nullable=False),
        sa.Column("approval_policy_json", sa.JSON(), nullable=False),
        sa.Column("budget_policy_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"]),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id"),
    )
    op.create_index("ix_runtime_snapshots_tenant_id", "runtime_snapshots", ["tenant_id"])
    op.create_index("ix_runtime_snapshots_run_id", "runtime_snapshots", ["run_id"])
    op.create_index("ix_runtime_snapshots_agent_id", "runtime_snapshots", ["agent_id"])


def downgrade() -> None:
    op.drop_index("ix_runtime_snapshots_agent_id", table_name="runtime_snapshots")
    op.drop_index("ix_runtime_snapshots_run_id", table_name="runtime_snapshots")
    op.drop_index("ix_runtime_snapshots_tenant_id", table_name="runtime_snapshots")
    op.drop_table("runtime_snapshots")
    op.drop_index("ix_checkpoints_snapshot_id", table_name="checkpoints")
    op.drop_column("checkpoints", "usage_json")
    op.drop_column("checkpoints", "snapshot_id")
    op.drop_column("checkpoints", "attempt_id")
    op.drop_index("ix_runs_snapshot_id", table_name="runs")
    op.drop_column("runs", "budget_json")
    op.drop_column("runs", "cost_usd")
    op.drop_column("runs", "usage_json")
    op.drop_column("runs", "schema_version")
    op.drop_column("runs", "snapshot_id")
