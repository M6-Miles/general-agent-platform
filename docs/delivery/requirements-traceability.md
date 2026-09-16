> **[历史记录]** 本文档为历史记录；当前有效状态请参阅 [current-release-status.md](current-release-status.md)。

# Requirements Traceability

| Area | Evidence | Status |
|---|---|---|
| Runtime lifecycle | `app/runtime.py`, `app/events.py`, runtime tests | implemented |
| Durable Runtime Events and SSE resume | `RuntimeEvent`, migration `f3a4b5c6d7e8`, SSE tests | implemented |
| Tenant quota and soft limit | `app/quota.py`, `/api/v1/tenant/usage`, quota tests | implemented |
| Approval one-time token | token hash, atomic consumption, approval tests | implemented |
| OpenAPI contract | `scripts/contract_check.py`, contract tests | implemented |
| Tool manifest and capability policy | `app/skill_sdk.py`, supply-chain migration | baseline implemented |
| PostgreSQL RLS baseline | migration `g4b5c6d7e8f9` | implemented and verified (see `docs/security/rls-verification.md`) |
| Metrics and readiness | `/metrics`, `/ready`, health tests | baseline implemented |
| Frontend workbench | Dashboard, Agents, Approvals, Audit routes | baseline implemented |
| Docker and disaster recovery | Compose, backup/restore scripts | implemented and exercised (see `docs/operations/backup-restore-drill-report.md`) |
| WebSocket, HA, multi-region, SSO | documented exclusions/extension items | excluded from current baseline |
