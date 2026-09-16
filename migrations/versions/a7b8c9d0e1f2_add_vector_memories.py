"""add tenant-isolated vector memories

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
"""

import sqlalchemy as sa
from alembic import op

revision = "a7b8c9d0e1f2"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        op.create_table(
            "vector_memories",
            sa.Column("id", sa.String(length=100), nullable=False),
            sa.Column("tenant_id", sa.String(length=100), nullable=False),
            sa.Column("agent_id", sa.String(length=100), nullable=False),
            sa.Column("run_id", sa.String(length=100), nullable=True),
            sa.Column("content", sa.String(length=5000), nullable=False),
            sa.Column("embedding_json", sa.JSON(), nullable=False),
            sa.Column("metadata_json", sa.JSON(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
            sa.ForeignKeyConstraint(["run_id"], ["runs.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        return
    op.execute("DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS vector; EXCEPTION WHEN undefined_file OR feature_not_supported THEN NULL; END $$")
    op.create_table(
        "vector_memories",
        sa.Column("id", sa.String(length=100), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("agent_id", sa.String(length=100), nullable=False),
        sa.Column("run_id", sa.String(length=100), nullable=True),
        sa.Column("content", sa.String(length=5000), nullable=False),
        sa.Column("embedding_json", sa.JSON(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"]),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute("DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN ALTER TABLE vector_memories ADD COLUMN embedding_vector vector(32); END IF; END $$")
    op.create_index("ix_vector_memories_tenant_id", "vector_memories", ["tenant_id"])
    op.create_index("ix_vector_memories_agent_id", "vector_memories", ["agent_id"])
    op.create_index("ix_vector_memories_run_id", "vector_memories", ["run_id"])


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.drop_index("ix_vector_memories_run_id", table_name="vector_memories")
        op.drop_index("ix_vector_memories_agent_id", table_name="vector_memories")
        op.drop_index("ix_vector_memories_tenant_id", table_name="vector_memories")
    op.drop_table("vector_memories")
