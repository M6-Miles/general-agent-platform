> **[历史记录]** 本文档为历史记录；当前有效状态请参阅 [current-release-status.md](current-release-status.md)。

# Test Evidence

Validated on 2026-08-28:

- Backend pytest: 91 tests passed and 1 PostgreSQL-only test skipped in process-isolated SQLite databases.
- Coverage: 83% overall (`app`), with generated runtime contract types at 100%.
- Ruff: `python -m ruff check app migrations scripts tests` passed.
- OpenAPI contract: all public business paths are documented and contract tests pass; internal framework/operations routes are excluded.
- Frontend: `npm run build --prefix web` passed, including TypeScript checking.
- Playwright: 7 spec files / 14 tests; two consecutive full runs passed on isolated API/Web ports `18001`/`13001` with one worker.
- Python compile check: `python -m compileall -q app migrations` passed.
- Alembic SQLite upgrade, downgrade, and upgrade cycle passed for the current migration chain.

- Docker Compose: API, Worker, PostgreSQL, and Redis are running; API/PostgreSQL health checks pass.
- PostgreSQL audit immutability triggers and migration head were verified against the live Compose database.
