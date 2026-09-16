# PostgreSQL RLS Verification

Validated on 2026-08-28 against the live Docker Compose PostgreSQL service at migration `k8f9a0b1c2d3`.

The verification uses a dedicated non-owner role, `rls_verifier`, with only `USAGE` on `public` and `SELECT` on `agents`. This matters because PostgreSQL table owners bypass RLS unless `FORCE ROW LEVEL SECURITY` is enabled.

Evidence:

- Without `app.tenant_id`, `SELECT count(*) FROM agents` returned `0`.
- With `SET LOCAL app.tenant_id='rls-tenant-b'`, all visible rows had `tenant_id='rls-tenant-b'`.
- With the demo tenant context, 8 rows were visible and both `min(tenant_id)` and `max(tenant_id)` matched the demo tenant.
- After transaction commit, `SET LOCAL` was cleared and the next query returned `0` rows.

Command-level regression coverage is in `tests/test_rls_runtime.py` and is enabled with `RUN_POSTGRES_RLS_TESTS=1` when the verifier role and Compose service exist. Normal SQLite unit runs skip this integration-only test.
