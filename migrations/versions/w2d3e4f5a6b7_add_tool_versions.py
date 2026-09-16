"""Add immutable tool configuration versions."""

from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "w2d3e4f5a6b7"
down_revision = "v1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tool_versions",
        sa.Column("id", sa.String(length=100), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("tool_definition_id", sa.String(length=100), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("executor", sa.String(length=100), nullable=False),
        sa.Column("input_schema", sa.JSON(), nullable=False),
        sa.Column("output_schema", sa.JSON(), nullable=False),
        sa.Column("side_effects", sa.Boolean(), nullable=False),
        sa.Column("risk_level", sa.String(length=20), nullable=False),
        sa.Column("timeout_ms", sa.Integer(), nullable=False),
        sa.Column("manifest_json", sa.JSON(), nullable=False),
        sa.Column("capabilities_json", sa.JSON(), nullable=False),
        sa.Column("content_digest", sa.String(length=64), nullable=True),
        sa.Column("signature_status", sa.String(length=20), nullable=False),
        sa.Column("created_by", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["tool_definition_id"], ["tool_definitions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tool_definition_id", "version", name="uq_tool_versions_tool_version"),
    )
    op.create_index("ix_tool_versions_tenant_id", "tool_versions", ["tenant_id"])
    op.create_index("ix_tool_versions_tool_definition_id", "tool_versions", ["tool_definition_id"])
    op.create_index("ix_tool_versions_content_digest", "tool_versions", ["content_digest"])

    bind = op.get_bind()
    source_table = sa.Table("tool_definitions", sa.MetaData(), autoload_with=bind)
    tools = bind.execute(sa.select(
        source_table.c.id,
        source_table.c.tenant_id,
        source_table.c.version,
        source_table.c.name,
        source_table.c.description,
        source_table.c.executor,
        source_table.c.input_schema,
        source_table.c.output_schema,
        source_table.c.side_effects,
        source_table.c.risk_level,
        source_table.c.timeout_ms,
        source_table.c.manifest_json,
        source_table.c.capabilities_json,
        source_table.c.content_digest,
        source_table.c.signature_status,
        source_table.c.created_by,
        source_table.c.created_at,
    )).mappings()
    version_table = sa.table(
        "tool_versions",
        sa.column("id", sa.String()),
        sa.column("tenant_id", sa.String()),
        sa.column("tool_definition_id", sa.String()),
        sa.column("version", sa.Integer()),
        sa.column("name", sa.String()),
        sa.column("description", sa.String()),
        sa.column("executor", sa.String()),
        sa.column("input_schema", sa.JSON()),
        sa.column("output_schema", sa.JSON()),
        sa.column("side_effects", sa.Boolean()),
        sa.column("risk_level", sa.String()),
        sa.column("timeout_ms", sa.Integer()),
        sa.column("manifest_json", sa.JSON()),
        sa.column("capabilities_json", sa.JSON()),
        sa.column("content_digest", sa.String()),
        sa.column("signature_status", sa.String()),
        sa.column("created_by", sa.String()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    rows = []
    for tool in tools:
        row = dict(tool)
        source_id = row.pop("id")
        row["id"] = str(uuid4())
        row["tool_definition_id"] = source_id
        rows.append(row)
    if rows:
        op.bulk_insert(version_table, rows)

    if bind.dialect.name == "postgresql":
        policy = "tenant_isolation_tool_versions"
        op.execute(sa.text("ALTER TABLE tool_versions ENABLE ROW LEVEL SECURITY"))
        op.execute(sa.text(f"DROP POLICY IF EXISTS {policy} ON tool_versions"))
        op.execute(sa.text(
            f"CREATE POLICY {policy} ON tool_versions "
            "USING (tenant_id = current_setting('app.tenant_id', true)) "
            "WITH CHECK (tenant_id = current_setting('app.tenant_id', true))"
        ))
        op.execute(sa.text("ALTER TABLE tool_versions FORCE ROW LEVEL SECURITY"))


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text("DROP POLICY IF EXISTS tenant_isolation_tool_versions ON tool_versions"))
    op.drop_index("ix_tool_versions_content_digest", table_name="tool_versions")
    op.drop_index("ix_tool_versions_tool_definition_id", table_name="tool_versions")
    op.drop_index("ix_tool_versions_tenant_id", table_name="tool_versions")
    op.drop_table("tool_versions")
