# 本地测试配置

测试套件在 `tests/conftest.py` 中强制使用按 pytest 进程隔离的 SQLite 数据库，不继承开发 shell 或 Docker Compose 中的 `DATABASE_URL`。这能避免本地测试意外连接生产式 PostgreSQL 地址。

每个测试开始前会把已有租户配额重置为不限量，防止配额 API 测试修改的并发、月度 Token 或成本限制影响后续 Run 测试。配额功能自身的测试仍可在测试体内设置明确限制并进行断言。

PostgreSQL RLS 集成测试默认跳过；在准备好独立 PostgreSQL 后显式设置 `RUN_POSTGRES_RLS_TESTS=1` 再运行 `tests/test_rls_runtime.py`。

推荐验证命令：

```powershell
ruff check app migrations scripts tests
pytest tests/ -q
pytest --cov=app --cov-report=term tests/ -q
```

Playwright 默认使用独立 API/Web 端口 `18001`/`13001`，为每个进程创建 SQLite 数据库与 Next.js 构建目录，并禁止复用已有服务。发布验收连续执行两次 `npx playwright test`，用于验证端口释放和重复运行稳定性。

CI 已执行 Ruff、pytest/覆盖率、OpenAPI 合同检查、生成类型同步检查、迁移升降级、Playwright 和前端构建。WebSocket 当前未实现运行时 endpoint，相关协议仍属于后续架构扩展。
