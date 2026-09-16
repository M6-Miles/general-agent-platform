"""add durable workflow instances"""
import sqlalchemy as sa
from alembic import op

revision = "n3c4d5e6f7a8"
down_revision = "m2b3c4d5e6f7"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table("workflow_instances",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("tenant_id", sa.String(100), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("workflow_id", sa.String(100), nullable=False),
        sa.Column("run_id", sa.String(100), sa.ForeignKey("runs.id")),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("input_json", sa.JSON, nullable=False),
        sa.Column("output_json", sa.JSON),
        sa.Column("created_by", sa.String(100), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_workflow_instances_tenant_id", "workflow_instances", ["tenant_id"])
    op.create_index("ix_workflow_instances_workflow_id", "workflow_instances", ["workflow_id"])
    op.create_index("ix_workflow_instances_status", "workflow_instances", ["status"])

def downgrade() -> None:
    op.drop_table("workflow_instances")
