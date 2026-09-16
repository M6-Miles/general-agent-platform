"""add explicit source chunk indexes for citations."""
import sqlalchemy as sa
from alembic import op

revision = "s8d9e0f1a2b3"
down_revision = "r7c8d9e0f1a2"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("knowledge_chunks", sa.Column("chunk_index", sa.Integer(), nullable=True, server_default="0"))
    op.execute("UPDATE knowledge_chunks SET chunk_index = position WHERE chunk_index IS NULL")
    with op.batch_alter_table("knowledge_chunks") as batch:
        batch.alter_column("chunk_index", nullable=False, server_default=None)

def downgrade() -> None:
    op.drop_column("knowledge_chunks", "chunk_index")
