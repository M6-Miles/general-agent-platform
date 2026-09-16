"""unify embedding storage at the production model dimension (384)."""

import sqlalchemy as sa
from alembic import op

revision = "q6b7c8d9e0f1"
down_revision = "p5a6b7c8d9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        # Existing vector(32) values cannot be safely widened; regenerate them with the
        # configured model after this migration.
        op.execute("ALTER TABLE vector_memories DROP COLUMN IF EXISTS embedding_vector")
        op.execute("ALTER TABLE vector_memories ADD COLUMN embedding_vector vector(384)")
        op.execute("ALTER TABLE knowledge_chunks ADD COLUMN embedding_vector vector(384)")
    else:
        op.add_column("vector_memories", sa.Column("embedding_vector", sa.JSON(), nullable=True))
        op.add_column("knowledge_chunks", sa.Column("embedding_vector", sa.JSON(), nullable=True))

    op.add_column("vector_memories", sa.Column("embedding_model", sa.String(255), nullable=True))
    op.add_column("vector_memories", sa.Column("embedding_generated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("knowledge_chunks", sa.Column("embedding_model", sa.String(255), nullable=True))
    op.add_column("knowledge_chunks", sa.Column("embedding_generated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("knowledge_chunks", "embedding_generated_at")
    op.drop_column("knowledge_chunks", "embedding_model")
    op.drop_column("knowledge_chunks", "embedding_vector")
    op.drop_column("vector_memories", "embedding_generated_at")
    op.drop_column("vector_memories", "embedding_model")
    op.drop_column("vector_memories", "embedding_vector")
