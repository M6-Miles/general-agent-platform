"""enable native pgvector storage and index when extension is available

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
"""

from alembic import op

revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("ALTER TABLE vector_memories ADD COLUMN IF NOT EXISTS embedding_vector vector(32)")
    op.execute("UPDATE vector_memories SET embedding_vector = embedding_json::text::vector WHERE embedding_vector IS NULL")
    op.execute("CREATE INDEX IF NOT EXISTS ix_vector_memories_embedding_hnsw ON vector_memories USING hnsw (embedding_vector vector_cosine_ops)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_vector_memories_embedding_hnsw")
