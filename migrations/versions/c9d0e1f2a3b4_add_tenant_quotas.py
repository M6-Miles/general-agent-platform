"""add tenant quota policy"""
import sqlalchemy as sa
from alembic import op

revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "tenant_quotas",
        sa.Column("tenant_id", sa.String(length=100), sa.ForeignKey("tenants.id"), primary_key=True),
        sa.Column("monthly_token_limit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("monthly_cost_limit_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("max_concurrent_runs", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("warning_percent", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

def downgrade() -> None:
    op.drop_table("tenant_quotas")
