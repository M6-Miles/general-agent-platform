"""add user preferences

Revision ID: l9a0b1c2d3e4
Revises: k8f9a0b1c2d3
"""
import sqlalchemy as sa
from alembic import op

revision = "l9a0b1c2d3e4"
down_revision = "k8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("preferences", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "preferences")
