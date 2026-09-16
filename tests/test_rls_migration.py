from pathlib import Path

MIGRATION = Path(__file__).parents[1] / "migrations" / "versions" / "t9a0b1c2d3e4_enable_rls_all_tenant_tables.py"


def test_rls_migration_covers_every_tenant_model_table():
    source = MIGRATION.read_text(encoding="utf-8")
    expected = {
        "users", "agents", "agent_versions", "runtime_snapshots", "vector_memories",
        "audit_events", "idempotency_records", "runs", "tool_definitions", "tool_calls",
        "workflow_nodes", "checkpoints", "approvals", "runtime_events", "tenant_quotas",
        "tenant_quota_monthly", "knowledge_bases", "knowledge_documents", "knowledge_chunks",
        "workflow_instances", "skill_definitions",
    }
    assert all(f'"{table}"' in source for table in expected)


def test_rls_policy_is_transaction_context_bound_and_reversible():
    source = MIGRATION.read_text(encoding="utf-8")
    assert "current_setting('app.tenant_id', true)" in source
    assert "ENABLE ROW LEVEL SECURITY" in source
    assert "DISABLE ROW LEVEL SECURITY" in source
    assert "DROP POLICY IF EXISTS" in source
