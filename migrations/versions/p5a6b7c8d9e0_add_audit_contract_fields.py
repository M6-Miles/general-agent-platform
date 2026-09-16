"""add tenant audit contract fields"""
import sqlalchemy as sa
from alembic import op

revision = "p5a6b7c8d9e0"
down_revision = "o4f5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    additions = {
        "users": [
            ("version", sa.Integer(), "1"),
            ("created_by", sa.String(100), None),
        ],
        "runs": [
            ("conversation_id", sa.String(100), None),
            ("agent_version_id", sa.String(100), None),
        ],
        "tool_calls": [
            ("attempt_id", sa.String(100), None),
            ("tool_version", sa.Integer(), "1"),
        ],
        "audit_events": [
            ("event_id", sa.String(100), None),
            ("schema_version", sa.Integer(), "1"),
            ("principal_type", sa.String(30), "'user'"),
            ("reason_code", sa.String(100), "''"),
            ("correlation_id", sa.String(100), None),
            ("ip_hash", sa.String(128), None),
            ("user_agent_hash", sa.String(128), None),
            ("metadata_redacted", sa.JSON(), None),
        ],
    }
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table, columns in additions.items():
        existing = {column["name"] for column in inspector.get_columns(table)}
        for name, column_type, default in columns:
            if name in existing:
                continue
            kwargs = {"nullable": True}
            if default is not None:
                kwargs["server_default"] = sa.text(default)
            op.add_column(table, sa.Column(name, column_type, **kwargs))
    # Backfill identifiers before enforcing uniqueness/indexes.
    op.execute("UPDATE audit_events SET event_id = id WHERE event_id IS NULL")
    op.execute("UPDATE audit_events SET correlation_id = request_id WHERE correlation_id IS NULL")
    op.execute("UPDATE audit_events SET metadata_redacted = metadata_json WHERE metadata_redacted IS NULL")
    op.create_index("ix_audit_events_event_id", "audit_events", ["event_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_audit_events_event_id", table_name="audit_events")
    for table, names in {
        "audit_events": ["metadata_redacted", "user_agent_hash", "ip_hash", "correlation_id", "reason_code", "principal_type", "schema_version", "event_id"],
        "tool_calls": ["tool_version", "attempt_id"],
        "runs": ["agent_version_id", "conversation_id"],
        "users": ["created_by", "version"],
    }.items():
        for name in names:
            op.drop_column(table, name)
