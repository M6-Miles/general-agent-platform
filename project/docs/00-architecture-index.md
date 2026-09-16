# OpenClaw Agent 平台文档索引

_负责人：架构委员会｜状态：维护中｜版本：v1.1｜最后更新：2026-08-24_

项目文档入口，面向架构、研发、安全、测试、运维和前端团队。

---

## 文档地图

| 文档 | 责任边界 | 依赖 |
|---|---|---|
| `01-agent-runtime-design.md` | Run 生命周期、上下文、工具调度和恢复 | `02`、`05`、`06`、`10` |
| `02-database-design.md` | 事务数据、版本快照、租户隔离和迁移 | `05`、`10` |
| `03-api-openapi-design.md` | HTTP 资源、错误、幂等和兼容性 | `02`、`05`、`10` |
| `04-websocket-protocol-design.md` | 实时事件、重连和补发 | `01`、`03` |
| `05-permission-security-design.md` | 身份、授权、威胁控制和审计 | 全部 |
| `06-skill-tool-sdk-design.md` | Skill/Tool 包和执行器契约 | `01`、`05`、`10` |
| `07-test-strategy.md` | 测试分层和 CI 门禁 | 全部 |
| `08-deployment-operations-design.md` | 部署、监控、备份和 Runbook | 全部 |
| `09-openclaw-agent-platform-frontend-design.md` | 前端交互和设计系统 | `03`、`04`、`05` |
| `10-shared-contracts.md` | 跨服务类型、错误码和幂等规则 | 全部 |
| `13-mvp-scope-and-exclusions.md` | 一个月交付范围、排除项和完成定义 | 全部 |
| `14-runtime-state-machine-contract.md` | Run、Tool Call、Workflow 节点状态机唯一事实源 | `01`、`04`、`10` |
| `15-tenant-audit-field-rules.md` | 多租户上下文、字段隔离和审计事件规则 | `02`、`05`、`10` |
| `openapi/openapi.yaml` | MVP HTTP API 的版本化机器可读事实源 | `03`、`10`、`13` |
| `schemas/runtime-contract.schema.json` | Runtime 和审计事件 JSON Schema | `10`、`14`、`15` |
| `OpenClaw通用Agent平台-Next.js企业级开发总控Prompt.md` | 分阶段开发约束和总体实现目标 | 全部 |

## 交付分期

- **MVP（阶段 0.2～1）**：租户/用户/RBAC、Agent 草稿与发布、会话、Run、基础 Skill/Tool、HTTP API、基础 WebSocket。
- **增强（阶段 2）**：审批恢复、用量计费、完整审计、版本回滚、恢复演练。
- **平台化（阶段 3+）**：知识库、工作流、渠道、插件和市场。

新增设计必须注明所属阶段、依赖文档和验收方式。跨文档字段以 `10-shared-contracts.md` 为共享语义；MVP 范围以 `13` 为准，状态以 `14` 为准，租户和审计字段以 `15` 为准，HTTP 接口以 `openapi/openapi.yaml` 为准，Runtime 事件以 `schemas/runtime-contract.schema.json` 为准。实现中的版本化 Schema 和数据库迁移完成后，必须通过合同测试并成为最终事实源。

## 文档治理规则

- 每份文档必须包含负责人、状态、版本和最后更新时间
- 规范性要求使用“必须/禁止”，方案性建议使用“建议/可选”
- 端点、事件、状态、错误码和数据库字段只能有一个事实源
- 发布前由架构、安全和测试负责人共同评审，变更必须记录 ADR 或变更记录

## 架构决策记录

重大选型记录在 `docs/adr/`，至少包含背景、决策、备选方案、影响和复审条件。当前已记录：

- `adr/0001-postgresql-as-transactional-source.md`
