"""add tool manifest and capability metadata"""
import sqlalchemy as sa
from alembic import op

revision = "h5c6d7e8f9a0"
down_revision = "g4b5c6d7e8f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tool_definitions", sa.Column("manifest_json", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("tool_definitions", sa.Column("capabilities_json", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("tool_definitions", sa.Column("content_digest", sa.String(length=64), nullable=True))
    op.add_column("tool_definitions", sa.Column("signature_status", sa.String(length=20), nullable=False, server_default="unsigned"))
    op.create_index("ix_tool_definitions_content_digest", "tool_definitions", ["content_digest"])


def downgrade() -> None:
    op.drop_index("ix_tool_definitions_content_digest", table_name="tool_definitions")
    op.drop_column("tool_definitions", "signature_status")
    op.drop_column("tool_definitions", "content_digest")
    op.drop_column("tool_definitions", "capabilities_json")
    op.drop_column("tool_definitions", "manifest_json")
