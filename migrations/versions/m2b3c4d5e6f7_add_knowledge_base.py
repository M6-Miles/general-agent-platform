"""add knowledge base documents and chunks"""
import sqlalchemy as sa
from alembic import op

revision = "m2b3c4d5e6f7"
down_revision = "l9a0b1c2d3e4"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table("knowledge_bases", sa.Column("id", sa.String(100), primary_key=True), sa.Column("tenant_id", sa.String(100), sa.ForeignKey("tenants.id"), nullable=False), sa.Column("slug", sa.String(120), nullable=False), sa.Column("name", sa.String(200), nullable=False), sa.Column("description", sa.String(1000), nullable=False, server_default=""), sa.Column("created_by", sa.String(100), sa.ForeignKey("users.id"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("deleted_at", sa.DateTime(timezone=True)), sa.UniqueConstraint("tenant_id", "slug", name="uq_knowledge_bases_tenant_slug"))
    op.create_index("ix_knowledge_bases_tenant_id", "knowledge_bases", ["tenant_id"])
    op.create_table("knowledge_documents", sa.Column("id", sa.String(100), primary_key=True), sa.Column("tenant_id", sa.String(100), sa.ForeignKey("tenants.id"), nullable=False), sa.Column("knowledge_base_id", sa.String(100), sa.ForeignKey("knowledge_bases.id"), nullable=False), sa.Column("filename", sa.String(255), nullable=False), sa.Column("content_type", sa.String(100), nullable=False, server_default="text/plain"), sa.Column("status", sa.String(30), nullable=False, server_default="processed"), sa.Column("created_by", sa.String(100), sa.ForeignKey("users.id"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_knowledge_documents_tenant_id", "knowledge_documents", ["tenant_id"])
    op.create_index("ix_knowledge_documents_knowledge_base_id", "knowledge_documents", ["knowledge_base_id"])
    op.create_table("knowledge_chunks", sa.Column("id", sa.String(100), primary_key=True), sa.Column("tenant_id", sa.String(100), sa.ForeignKey("tenants.id"), nullable=False), sa.Column("knowledge_base_id", sa.String(100), sa.ForeignKey("knowledge_bases.id"), nullable=False), sa.Column("document_id", sa.String(100), sa.ForeignKey("knowledge_documents.id"), nullable=False), sa.Column("position", sa.Integer, nullable=False), sa.Column("content", sa.String(5000), nullable=False), sa.Column("embedding_json", sa.JSON, nullable=False), sa.Column("metadata_json", sa.JSON, nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_knowledge_chunks_tenant_id", "knowledge_chunks", ["tenant_id"])
    op.create_index("ix_knowledge_chunks_knowledge_base_id", "knowledge_chunks", ["knowledge_base_id"])
    op.create_index("ix_knowledge_chunks_document_id", "knowledge_chunks", ["document_id"])

def downgrade() -> None:
    op.drop_table("knowledge_chunks"); op.drop_table("knowledge_documents"); op.drop_table("knowledge_bases")
