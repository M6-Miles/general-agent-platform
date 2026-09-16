# 发布候选 RC1 审查清单（2026-09-15）

本文件描述当前工作区的本地演示发布候选。它是可审查快照，不是生产发布声明，也尚未创建 Git 标签。

## 候选范围

- 统一正式前端为 `web/app`，旧设计入口只保留重定向。
- 登录、注册、忘记密码和管理员用户管理。
- Agent 创建、发布、版本、测试执行和真实模型 Provider 配置。
- Skill、工具版本、编辑、回滚和真实工具调用审计。
- 知识库创建、文档上传、检索与移动端体验。
- ReactFlow 工作流编辑、节点属性、连线、条件分支及前后端配置校验。
- Run、WorkflowInstance、Checkpoint、重放、取消、审批、审计和租户隔离。
- PostgreSQL RLS、Redis Worker 协调、迁移、Compose 和生产配置演练脚本。

## 当前验证证据

2026-09-15 在 Windows 本地环境完成：

| 检查 | 结果 |
| --- | --- |
| 后端完整 pytest | 通过；PostgreSQL 专用条件以测试环境能力决定是否跳过 |
| Ruff | `ruff check app migrations scripts tests` 通过 |
| 前端单元测试 | 19 个文件、46 个测试通过 |
| TypeScript | `npx tsc --noEmit` 通过 |
| Next.js production build | 通过，31 条路由完成构建 |
| Playwright | 隔离环境 23/23 通过 |
| Docker Compose | PostgreSQL、Redis、API、Worker、Web 正常运行 |
| 健康检查 | API `/ready` 和 Web `/workflows/create` 均返回 200 |
| 文档格式 | `python scripts/check_docs.py` 纳入候选门禁 |

工作流浏览器覆盖包含模型 Prompt、工具 JSON、条件双分支、移动端触控和真实工具执行。

分支级复审额外修复了刷新后旧认证头与错误缓存身份、工作流局部更新丢失连线、条件分支线重载丢失、非法边静默保存、密码重置缺少限流、`prod` Cookie 未启用 Secure，以及 SMTP 密码未从 Secret Manager 加载的问题。

## 建议审查顺序

1. 数据库迁移及模型：`migrations/versions/`、`app/models.py`、`app/schemas.py`。
2. 后端路由拆分和安全边界：`app/routers/`、`app/security.py`、`app/dependencies.py`。
3. Runtime 与 Worker：`app/runtime.py`、`app/worker.py`。
4. 正式前端与 API 类型：`web/app/`、`web/lib/api.ts`。
5. 回归测试：`tests/`、`playwright/`。
6. Compose、密钥和运维文档：`docker-compose*.yml`、`scripts/`、`docs/operations/`、`docs/runbooks/`。

## 提交前清理边界

以下内容不应作为产品源码审查重点：

- `test-results/` 下的失败快照和 `.last-run.json`，属于 Playwright 生成产物。
- `web/tsconfig.tsbuildinfo`，属于 TypeScript 增量构建产物。
- 根目录历史 `AUDIT_*` 报告，仅作为过程记录，不代表当前状态。

清理上述已跟踪产物需要单独确认其 Git 历史策略；本轮没有擅自恢复或删除用户已有改动。

## 已知限制

- 本地演示默认账号和密码不得用于公网或生产环境。
- SMTP、正式 Secret Manager、密钥轮换和真实生产管理员仍需外部服务凭据。
- 正式容量压测、故障注入、渗透测试、镜像签名和漏洞门禁尚未完成。
- Starlette/httpx 与 fontTools 依赖存在弃用警告，当前不影响功能，但应在依赖升级任务中处理。
- 工作区变更规模较大，合并前应按上面的审查顺序拆分提交，避免形成单个超大提交。

## 本地演示入口

初始化、账号、真实模型配置和数据重置请参阅 [本地演示初始化与重置](../runbooks/local-demo.md)。工作流错误契约请参阅 [工作流节点校验与错误响应](../api/workflow-validation.md)。
