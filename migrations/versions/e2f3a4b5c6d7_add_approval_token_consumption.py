"""add one-time approval token consumption fields"""
import sqlalchemy as sa
from alembic import op

revision = "e2f3a4b5c6d7"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("approvals", sa.Column("token_hash", sa.String(length=64), nullable=True))
    op.add_column("approvals", sa.Column("snapshot_id", sa.String(length=100), nullable=True))
    op.add_column("approvals", sa.Column("used_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_approvals_token_hash", "approvals", ["token_hash"], unique=True)
    op.create_index("ix_approvals_snapshot_id", "approvals", ["snapshot_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_approvals_snapshot_id", table_name="approvals")
    op.drop_index("ix_approvals_token_hash", table_name="approvals")
    op.drop_column("approvals", "used_at")
    op.drop_column("approvals", "snapshot_id")
    op.drop_column("approvals", "token_hash")
