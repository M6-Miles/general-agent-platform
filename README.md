# 通用 Agent 平台

一个可本地部署、可审计、支持多租户的 AI Agent 编排平台。用户可以在网页上创建 Agent，配置 Skill、Tool 和知识库，拖拽工作流，执行一次 Run，并查看实时事件、工具调用、审批、Token、成本和审计记录。

> 重要提醒：仓库示例配置默认使用 Mock Model 和 Mock Embedding，不调用外部大模型，也不会产生 API 费用。你可以在本地 .env 中选择 DeepSeek 等 OpenAI-compatible 模型。真实 API Key 只允许保存在本地环境变量或 Secret Manager 中，不能提交到 GitHub。

## 你将得到什么

- Agent 列表、创建向导、详情、版本发布、回滚和测试工作台
- Skill、Tool、知识库和文档管理
- ReactFlow 工作流编辑器，支持节点属性、连线、条件分支和校验
- 会话记录、Run 详情、实时流式输出和断线恢复
- 审批、审计、成本汇总、租户用量和管理设置
- FastAPI REST API、SSE 事件流、PostgreSQL/pgvector、Redis 和异步 Worker

## 项目不会做什么

- 不自动替用户做投资、医疗或其他高风险决策
- 不默认连接真实券商、支付系统或企业生产数据
- 不默认调用收费大模型
- 不把 Mock 输出伪装成真实模型结果
- 不把 SQLite 测试结果当作 PostgreSQL RLS 的生产证明
- 不承诺已经完成 Kubernetes、HA、跨区域灾备、SSO 或完整生产容量认证

所有 AI 输出和演示数据都应结合业务规则人工复核。生产部署前必须单独完成密钥托管、容量压测、渗透测试、镜像扫描和灾备演练。

## 技术栈

| 层次 | 当前技术 | 主要用途 |
| --- | --- | --- |
| 前端 | Next.js 16.3.2、React 18、TypeScript | 多页面管理控制台、表单、会话和工作流编辑 |
| 工作流 | @xyflow/react | 节点、连线、条件分支和可视化编辑 |
| 后端 | Python 3.11、FastAPI、Uvicorn | API、鉴权、业务校验和 SSE |
| 数据库 | SQLAlchemy 2、Alembic、PostgreSQL 16、pgvector | 事务数据、迁移、租户隔离和向量检索 |
| 异步执行 | Redis 7、Python Worker | Run 排队、锁、恢复和后台执行 |
| 模型 | Mock、OpenAI-compatible | 离线测试或 DeepSeek 等真实模型 |
| 检索 | Mock Embedding、sentence-transformers、BM25 | 知识库语义和关键词检索 |
| 质量保障 | pytest、Vitest、Playwright、Ruff | 单元、接口、前端和浏览器验收 |
| 部署 | Docker Compose、Prometheus | 本地一键启动和基础观测 |

正式前端源码只有 web/app。web/web 已移除，/agents-modern 和 /demo-new-design 仅保留兼容重定向。

## 核心概念

| 概念 | 大白话 | 系统职责 |
| --- | --- | --- |
| Agent | 一个有目标、有规则、会调用能力的 AI 员工 | 保存提示词、模型、权限和发布版本 |
| Skill | 一套可复用的岗位方法 | 提供说明型能力，并受版本和权限管理 |
| Tool | AI 可以按规则点击的按钮或接口 | Schema 校验、风险分级、幂等、审批和审计 |
| Knowledge Base | AI 的资料柜 | 文档分块、Embedding、BM25/向量检索和来源引用 |
| Workflow | 把办事步骤画成流程图 | DAG 节点、条件分支、顺序执行和状态校验 |
| Run | 一次具体的执行过程 | 保存输入、输出、状态、事件、Checkpoint 和成本 |

## Docker 快速开始

环境要求：Docker Desktop（Linux containers）和至少 4 GB 可用内存。

在项目根目录执行：

~~~~powershell
Copy-Item .env.example .env
docker compose --profile frontend up -d --build
docker compose --profile frontend ps
~~~~

Compose 会依次启动 PostgreSQL、迁移、演示数据、数据库运行时角色、API、Worker 和 Web。

| 服务 | 地址 |
| --- | --- |
| Web | http://localhost:3000 |
| API 健康检查 | http://localhost:8000/health |
| API 就绪检查 | http://localhost:8000/ready |
| OpenAPI | http://localhost:8000/docs |

本地演示账号、密码和重置方法见 docs/runbooks/local-demo.md。演示账号只用于本机，不要用于公网。

修改 .env 后执行：

~~~~powershell
docker compose up -d --force-recreate api worker
docker compose logs --tail=100 api worker
~~~~

停止服务：docker compose --profile frontend stop。重置本地演示数据：.\scripts\reset_local_demo.ps1。重置会删除 Compose 管理的数据卷。

## 真实 AI 和知识库配置

默认离线配置：

~~~~env
MODEL_PROVIDER=mock
EMBEDDING_PROVIDER=mock
~~~~

接入 DeepSeek：

~~~~env
MODEL_PROVIDER=openai_compatible
MODEL_BASE_URL=https://api.deepseek.com/v1
MODEL_API_KEY=填写你自己的密钥
MODEL_NAME=deepseek-chat
~~~~

MODEL_API_KEY 不要写入 .env.example、README、截图、日志或 Git 提交。余额不足、模型名错误或网络不可用时，真实对话会失败。

知识库默认使用 Mock Embedding，不需要下载大型模型。要启用本地语义模型：

~~~~env
EMBEDDING_PROVIDER=sentence_transformers
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
~~~~

首次使用可能占用约 2 GB 磁盘。这个模型只负责把文档和问题转换成向量，不负责生成最终回答。切换 Provider 后，已有文档需要重新生成 Embedding。

## 推荐演示流程

1. 登录管理控制台。
2. 创建一个 Agent 草稿并保存。
3. 打开 Skill 或创建一个 Tool，查看权限和风险字段。
4. 创建知识库，上传一份短文档，执行一次搜索。
5. 创建工作流，连接开始、准备、模型、条件、工具和结束节点。
6. 从会话页执行 Agent，观察 SSE 流式事件。
7. 打开 Run 详情，查看输出、节点状态、工具调用、Token、成本和审计记录。
8. 修改 Agent 草稿后再次运行，说明版本快照不会被历史 Run 影响。

## 一次请求是怎么跑的

1. 前端携带 JWT 向 FastAPI 提交 Run。
2. API 从 Token 得到用户、角色和 tenant_id，执行权限和资源范围检查。
3. API 创建 Run、初始事件和运行时快照，把任务交给 Worker。
4. Worker 获取锁，按 Workflow DAG 执行模型、条件和 Tool 节点。
5. 每个关键节点写入 RuntimeEvent 和 Checkpoint；高风险 Tool 可进入审批等待。
6. 模型 Provider 返回文本和 Token 用量，Tool 返回结构化结果。
7. 前端通过 SSE 接收增量和节点状态；断线后可使用 Last-Event-ID 恢复。
8. Run 完成、失败、取消或暂停，最终状态和审计记录保存到数据库。

## 安全和工程亮点

- 应用层 RBAC 加 PostgreSQL RLS 的双重租户隔离。
- Agent 发布版本和 RuntimeSnapshot 保证执行可复现。
- Tool 有 allowlist、JSON Schema、风险等级、超时、幂等和审批边界。
- Run 有事件、Checkpoint、重放、恢复、取消和失败定位能力。
- 模型 Provider 可替换，Mock 让测试不依赖网络和余额。
- OpenAPI、数据库迁移、前后端类型、测试和文档都有检查入口。

## 当前事实和已知不足

截至 2026-09-16：

- OpenAPI 已文档化 55 个公开路径，运行时共 63 个路径。
- 正式前端为 web/app，共有 38 个 page.tsx 路由文件。
- 后端 pytest --collect-only 收集 223 项测试；本地完整回归通过。
- Web Vitest 当前 19 个文件、46 项测试通过；Next.js 构建通过。
- 认证、Agent、Workflow、Settings 已拆到 app/routers；app/main.py 仍较大，Tool、Skill、Knowledge、Run 等路由还可继续拆分。
- 生产密钥托管、正式容量压测、渗透测试、镜像签名、WAL/PITR、OpenTelemetry 和集中式日志仍属于后续工作。
- 认证型 Playwright 用例需要设置 E2E_ADMIN_EMAIL 和 E2E_ADMIN_PASSWORD，否则相关用例会跳过。

## 验证命令

~~~~powershell
ruff check app migrations scripts tests
pytest tests/ -q
npm test --prefix web
npm run build --prefix web
python scripts/contract_check.py
python scripts/check_docs.py
python scripts/release_check.py
python scripts/check_repo_hygiene.py
~~~~

PostgreSQL RLS 集成测试：

~~~~powershell
$env:RUN_POSTGRES_RLS_TESTS = "1"
pytest tests/test_rls_runtime.py -q
~~~~

## 文档导航

- 本地启动、账号、真实模型和重置：docs/runbooks/local-demo.md
- 当前发布状态：docs/delivery/current-release-status.md
- 已知限制：docs/delivery/known-limitations.md
- API 合同：project/docs/openapi/openapi.yaml
- 架构设计：project/docs/01-agent-runtime-design.md
- RLS 验证：docs/security/rls-verification.md
- 前端说明：web/README_FRONTEND.md
- 面试和学校申请讲解文档：项目交付目录中的“通用 Agent 平台项目深度讲解_当前事实版.docx”

## 提交和部署注意事项

不要提交 .env、数据库文件、备份、日志、node_modules、.next、测试报告、Embedding 模型权重和本地缓存。提交前运行：

~~~~powershell
python scripts/secret_scan.py
python scripts/check_repo_hygiene.py
git status --short
~~~~

生产 Compose 已禁用演示 seed。生产管理员、Secret Manager、SMTP 和正式域名必须通过受控部署流程提供，不能复用本地演示账号和密码。
