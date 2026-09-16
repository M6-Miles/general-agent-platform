"""add durable runtime events"""
import sqlalchemy as sa
from alembic import op

revision = "f3a4b5c6d7e8"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "runtime_events",
        sa.Column("id", sa.String(length=100), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("run_id", sa.String(length=100), nullable=False),
        sa.Column("attempt_id", sa.String(length=100), nullable=False),
        sa.Column("event_id", sa.String(length=100), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "attempt_id", "sequence", name="uq_runtime_events_sequence"),
        sa.UniqueConstraint("run_id", "event_id", name="uq_runtime_events_event_id"),
    )
    op.create_index("ix_runtime_events_tenant_id", "runtime_events", ["tenant_id"])
    op.create_index("ix_runtime_events_run_id", "runtime_events", ["run_id"])
    op.create_index("ix_runtime_events_attempt_id", "runtime_events", ["attempt_id"])
    op.create_index("ix_runtime_events_event_id", "runtime_events", ["event_id"])
    op.create_index("ix_runtime_events_event_type", "runtime_events", ["event_type"])
    op.create_index("ix_runtime_events_created_at", "runtime_events", ["created_at"])
    op.create_index("ix_runtime_events_expires_at", "runtime_events", ["expires_at"])


def downgrade() -> None:
    for name in ("ix_runtime_events_expires_at", "ix_runtime_events_created_at", "ix_runtime_events_event_type", "ix_runtime_events_event_id", "ix_runtime_events_attempt_id", "ix_runtime_events_run_id", "ix_runtime_events_tenant_id"):
        op.drop_index(name, table_name="runtime_events")
    op.drop_table("runtime_events")
