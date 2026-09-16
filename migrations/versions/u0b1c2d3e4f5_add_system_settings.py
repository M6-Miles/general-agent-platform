"""Add persisted process-wide system settings."""

import sqlalchemy as sa
from alembic import op

revision = "u0b1c2d3e4f5"
down_revision = "t9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(length=100), primary_key=True),
        sa.Column("value_json", sa.JSON(), nullable=False),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_system_settings_updated_by", "system_settings", ["updated_by"])


def downgrade() -> None:
    op.drop_index("ix_system_settings_updated_by", table_name="system_settings")
    op.drop_table("system_settings")
