"""add tenant monthly quota summaries"""
import sqlalchemy as sa
from alembic import op

revision = "k8f9a0b1c2d3"
down_revision = "j7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenant_quota_monthly",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("tenant_id", sa.String(100), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("year_month", sa.String(7), nullable=False),
        sa.Column("total_usage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quota_limit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", "year_month", name="uq_tenant_quota_monthly_period"),
    )
    op.create_index("ix_tenant_quota_monthly_tenant_id", "tenant_quota_monthly", ["tenant_id"])
    op.create_index("ix_tenant_quota_monthly_year_month", "tenant_quota_monthly", ["year_month"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE tenant_quota_monthly ENABLE ROW LEVEL SECURITY")
        op.execute("CREATE POLICY tenant_isolation_tenant_quota_monthly ON tenant_quota_monthly USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true))")


def downgrade() -> None:
    op.drop_index("ix_tenant_quota_monthly_year_month", table_name="tenant_quota_monthly")
    op.drop_index("ix_tenant_quota_monthly_tenant_id", table_name="tenant_quota_monthly")
    op.drop_table("tenant_quota_monthly")
