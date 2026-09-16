> **[历史记录]** 本文档为历史记录；当前有效状态请参阅 [current-release-status.md](current-release-status.md)。

# Known Limitations

The current release is an enterprise-grade research and MVP baseline, not a claim of fully operated production capacity.

- PostgreSQL RLS policies are deployed; live non-owner policy evidence is recorded in `docs/security/rls-verification.md`.
- Docker Compose and logical backup/restore are exercised locally. WAL/PITR and cross-region recovery remain production infrastructure work.
- Tool supply-chain metadata and validation are implemented; signing, SBOM generation, vulnerability scanning, and isolated sandbox execution remain deployment integrations.
- Metrics are Prometheus-compatible baseline counters; OpenTelemetry export and centralized alert routing remain deployment integrations.
- The frontend has product routes, shared navigation, a ReactFlow workflow editor, and a Skill marketplace. i18n and component-level Vitest coverage are not included.
- WebSocket, Kubernetes, HA, SSO/OIDC, and cross-region disaster recovery remain explicit extension items from the MVP scope.
