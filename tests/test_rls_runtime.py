import os
import subprocess

import psycopg
import pytest

_TENANT_ID = "rls-tenant-b"
_USER_ID = "rls-user-b"
_AGENT_ID = "rls-agent-b"
_TOOL_ID = "rls-tool-b"
_TOOL_VERSION_ID = "rls-tool-version-b"


def _prepare_fixture(database_url: str) -> None:
    """Create a tenant-scoped row with the migration owner before verification."""
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        cursor.execute("SELECT set_config('app.tenant_id', %s, true)", (_TENANT_ID,))
        cursor.execute(
            """
            INSERT INTO tenants (id, name, slug, status, version, created_at, updated_at)
            VALUES (%s, 'RLS Test Tenant', 'rls-test', 'active', 1, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            (_TENANT_ID,),
        )
        cursor.execute(
            """
            INSERT INTO users (id, tenant_id, email, display_name, password_hash, role, status, version, created_at, updated_at)
            VALUES (%s, %s, 'rls-test@example.com', 'RLS Test User', 'fixture', 'admin', 'active', 1, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            (_USER_ID, _TENANT_ID),
        )
        cursor.execute(
            """
            INSERT INTO agents (id, tenant_id, name, status, definition, version, created_by, updated_by, created_at, updated_at)
            VALUES (%s, %s, 'RLS fixture agent', 'draft', '{}'::json, 1, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            (_AGENT_ID, _TENANT_ID, _USER_ID, _USER_ID),
        )
        cursor.execute(
            """
            INSERT INTO tool_definitions (
                id, tenant_id, name, version, description, executor, input_schema, output_schema,
                side_effects, risk_level, timeout_ms, status, created_by, created_at,
                manifest_json, capabilities_json, signature_status
            ) VALUES (
                %s, %s, 'RLS fixture tool', 1, '', 'builtin.echo', '{}'::json, '{}'::json,
                FALSE, 'low', 5000, 'active', %s, NOW(), '{}'::json, '{}'::json, 'unsigned'
            ) ON CONFLICT (id) DO NOTHING
            """,
            (_TOOL_ID, _TENANT_ID, _USER_ID),
        )
        cursor.execute(
            """
            INSERT INTO tool_versions (
                id, tenant_id, tool_definition_id, version, name, description, executor,
                input_schema, output_schema, side_effects, risk_level, timeout_ms,
                manifest_json, capabilities_json, signature_status, created_by, created_at
            ) VALUES (
                %s, %s, %s, 1, 'RLS fixture tool', '', 'builtin.echo', '{}'::json, '{}'::json,
                FALSE, 'low', 5000, '{}'::json, '{}'::json, 'unsigned', %s, NOW()
            ) ON CONFLICT (id) DO NOTHING
            """,
            (_TOOL_VERSION_ID, _TENANT_ID, _TOOL_ID, _USER_ID),
        )
        connection.commit()


def _cleanup_fixture(database_url: str) -> None:
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        cursor.execute("SELECT set_config('app.tenant_id', %s, true)", (_TENANT_ID,))
        cursor.execute("DELETE FROM tool_versions WHERE id = %s", (_TOOL_VERSION_ID,))
        cursor.execute("DELETE FROM tool_definitions WHERE id = %s", (_TOOL_ID,))
        cursor.execute("DELETE FROM agents WHERE id = %s", (_AGENT_ID,))
        cursor.execute("DELETE FROM users WHERE id = %s", (_USER_ID,))
        cursor.execute("DELETE FROM tenants WHERE id = %s", (_TENANT_ID,))
        connection.commit()


def _compose_psql(user: str, sql: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["docker", "compose", "exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", "agent_runtime", "-Atc", sql],
        capture_output=True,
        text=True,
        check=False,
    )


def _prepare_compose_fixture() -> None:
    sql = f"""
    INSERT INTO tenants (id, name, slug, status, version, created_at, updated_at)
    VALUES ('{_TENANT_ID}', 'RLS Test Tenant', 'rls-test', 'active', 1, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;
    INSERT INTO users (id, tenant_id, email, display_name, password_hash, role, status, version, created_at, updated_at)
    VALUES ('{_USER_ID}', '{_TENANT_ID}', 'rls-test@example.com', 'RLS Test User', 'fixture', 'admin', 'active', 1, NOW(), NOW()) ON CONFLICT (id) DO NOTHING;
    INSERT INTO agents (id, tenant_id, name, status, definition, version, created_by, updated_by, created_at, updated_at)
    VALUES ('{_AGENT_ID}', '{_TENANT_ID}', 'RLS fixture agent', 'draft', '{{}}'::json, 1, '{_USER_ID}', '{_USER_ID}', NOW(), NOW()) ON CONFLICT (id) DO NOTHING;
    INSERT INTO tool_definitions (id, tenant_id, name, version, description, executor, input_schema, output_schema, side_effects, risk_level, timeout_ms, status, created_by, created_at, manifest_json, capabilities_json, signature_status)
    VALUES ('{_TOOL_ID}', '{_TENANT_ID}', 'RLS fixture tool', 1, '', 'builtin.echo', '{{}}'::json, '{{}}'::json, FALSE, 'low', 5000, 'active', '{_USER_ID}', NOW(), '{{}}'::json, '{{}}'::json, 'unsigned') ON CONFLICT (id) DO NOTHING;
    INSERT INTO tool_versions (id, tenant_id, tool_definition_id, version, name, description, executor, input_schema, output_schema, side_effects, risk_level, timeout_ms, manifest_json, capabilities_json, signature_status, created_by, created_at)
    VALUES ('{_TOOL_VERSION_ID}', '{_TENANT_ID}', '{_TOOL_ID}', 1, 'RLS fixture tool', '', 'builtin.echo', '{{}}'::json, '{{}}'::json, FALSE, 'low', 5000, '{{}}'::json, '{{}}'::json, 'unsigned', '{_USER_ID}', NOW()) ON CONFLICT (id) DO NOTHING;
    """
    result = _compose_psql("agent", sql)
    assert result.returncode == 0, result.stderr


def _cleanup_compose_fixture() -> None:
    sql = f"""
    DELETE FROM tool_versions WHERE id = '{_TOOL_VERSION_ID}';
    DELETE FROM tool_definitions WHERE id = '{_TOOL_ID}';
    DELETE FROM agents WHERE id = '{_AGENT_ID}';
    DELETE FROM users WHERE id = '{_USER_ID}';
    DELETE FROM tenants WHERE id = '{_TENANT_ID}';
    """
    result = _compose_psql("agent", sql)
    assert result.returncode == 0, result.stderr


@pytest.mark.skipif(
    os.getenv("RUN_POSTGRES_RLS_TESTS") != "1" and not os.getenv("TEST_DATABASE_URL"),
    reason="requires Compose PostgreSQL verifier role",
)
def test_postgres_rls_non_owner_tenant_isolation_and_transaction_cleanup():
    admin_database_url = os.getenv("RLS_ADMIN_DATABASE_URL")
    sql = "RESET app.tenant_id; BEGIN; SET LOCAL app.tenant_id='rls-tenant-b'; SELECT string_agg(tenant_id,',') FROM agents; SELECT string_agg(tenant_id,',') FROM tool_versions; COMMIT; SELECT count(*) FROM agents; SELECT count(*) FROM tool_versions;"
    database_url = os.getenv("TEST_DATABASE_URL")
    if database_url:
        if admin_database_url:
            _prepare_fixture(admin_database_url)
        try:
            with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
                # Execute each statement separately so psycopg exposes both
                # SELECT result sets instead of returning the first command's
                # status when a multi-statement string is used.
                cursor.execute("RESET app.tenant_id")
                connection.commit()
                cursor.execute("BEGIN")
                cursor.execute("SET LOCAL app.tenant_id='rls-tenant-b'")
                cursor.execute("SELECT string_agg(tenant_id,',') FROM agents")
                assert cursor.fetchone()[0] == _TENANT_ID
                cursor.execute("SELECT string_agg(tenant_id,',') FROM tool_versions")
                assert cursor.fetchone()[0] == _TENANT_ID
                cursor.execute("COMMIT")
                cursor.execute("SELECT count(*) FROM agents")
                assert cursor.fetchone()[0] == 0
                cursor.execute("SELECT count(*) FROM tool_versions")
                assert cursor.fetchone()[0] == 0
        finally:
            if admin_database_url:
                _cleanup_fixture(admin_database_url)
        return
    _cleanup_compose_fixture()
    _prepare_compose_fixture()
    try:
        result = _compose_psql("rls_verifier", sql)
        assert result.returncode == 0, result.stderr
        values = [line for line in result.stdout.splitlines() if line not in {"RESET", "BEGIN", "SET", "COMMIT"}]
        assert values == [_TENANT_ID, _TENANT_ID, "0", "0"]
    finally:
        _cleanup_compose_fixture()
