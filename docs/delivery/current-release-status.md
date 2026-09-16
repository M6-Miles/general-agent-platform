# 通用 Agent 平台当前发布状态

**更新时间**：2026-09-16
**状态**：发布候选（本地验收通过，生产门禁未完成）

## 本地验证基线

- 后端：`pytest -q` 完整回归通过；数量以 CI 收集结果为准。
- 静态检查：`ruff check app tests` 通过。
- 前端：19 个测试文件、46 个测试通过；`npm run build --prefix web` 构建成功。
- 浏览器：隔离环境 `npx playwright test`，23/23 通过。
- OpenAPI：`python scripts/contract_check.py`，当前实测 `contract-ok paths=55 runtime_paths=63`。
- 文档检查：`python scripts/check_docs.py`，`docs-check-ok`。
- 迁移、备份恢复、RLS 和 Prometheus/Grafana 已有本地证据。

## 当前已完成

Agent、Run、Tool、Skill、审批、审计、多租户隔离、RAG 基础闭环、ReactFlow 工作流节点属性与校验、WorkflowInstance、SSE 断线恢复和前端核心页面。

Worker 已具备 Redis Run 锁（TTL 300 秒）、卡住 Run 恢复、审批等待恢复和工作流 Tool 幂等键；相关测试纳入全量回归。

## 尚未关闭的生产门禁

- 密钥撤销和轮换（需外部 Secret/CI 权限）。
- 正式容量压测、故障注入和渗透测试。
- SBOM、镜像漏洞扫描、签名验签。
- WAL/PITR、跨区域灾备和 HA。
- WebSocket 运行时（需架构确认，当前使用 SSE）。
- OpenTelemetry Trace、真实数据库连接池 Gauge 和集中式日志尚未接入。

本轮候选范围、审查顺序和已知限制见 [发布候选 RC1 审查清单](release-candidate-2026-09-15.md)。本地初始化和数据重置见 [本地演示初始化与重置](../runbooks/local-demo.md)。

本文是当前状态唯一汇总；其他阶段报告属于历史记录，不应覆盖本基线。
