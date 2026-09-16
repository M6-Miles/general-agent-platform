"""add request and resource quota limits"""
import sqlalchemy as sa
from alembic import op

revision = "r7c8d9e0f1a2"
down_revision = "q6b7c8d9e0f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenant_quotas", sa.Column("max_requests_per_minute", sa.Integer(), nullable=False, server_default="120"))
    op.add_column("tenant_quotas", sa.Column("max_knowledge_documents", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("tenant_quotas", sa.Column("max_workflow_runs_per_day", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("tenant_quotas", "max_workflow_runs_per_day")
    op.drop_column("tenant_quotas", "max_knowledge_documents")
    op.drop_column("tenant_quotas", "max_requests_per_minute")
