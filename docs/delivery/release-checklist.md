> **[历史记录]** 本文档为历史记录；当前有效状态请参阅 [current-release-status.md](current-release-status.md)。

# Release Checklist

- [x] Runtime Event persistence and SSE resume
- [x] Run state transition guard
- [x] Tenant quota and soft-limit baseline
- [x] Approval token hashing and atomic consumption
- [x] OpenAPI path contract check in CI
- [x] Tool manifest/capability validation
- [x] Prometheus metrics and readiness checks
- [x] Frontend workbench routes and responsive baseline
- [x] Backend, frontend, contract, and Playwright checks
- [x] PostgreSQL RLS integration run with live PostgreSQL (see `docs/security/rls-verification.md`)
- [x] Docker Compose clean-environment run (see `docs/delivery/test-evidence.md`)
- [x] Backup restore and RTO/RPO exercise (see `docs/operations/backup-restore-drill-report.md`, RTO: 28.2s, RPO: 0)
- [ ] Formal load, failure-injection, and penetration reports (production release gate; local baseline load evidence only)

The load baseline is suitable for MVP acceptance. Formal k6/Gatling capacity, failure-injection, and penetration testing remain production-environment release gates.
