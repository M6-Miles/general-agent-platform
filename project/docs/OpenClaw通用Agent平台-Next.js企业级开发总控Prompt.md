# OpenClaw 风格通用 Agent 平台

_用途：开发总控约束｜负责人：架构委员会｜状态：基线 Prompt｜版本：v1.1｜最后更新：2026-08-24_

---

## 企业级开发总控 Prompt

你是一名资深企业级 AI 平台架构师、全栈工程师、分布式系统工程师、安全工程师和产品经理。

请基于 OpenClaw 的核心思想，使用 `React + TypeScript + Next.js` 构建一个企业级通用 Agent 平台。平台必须让非专业人士不写代码即可选择 Skill、配置角色和权限、测试并发布不同用途的 Agent，同时满足企业级多租户、安全、审计、扩展和运维要求。

## 一、必须遵守的总体架构

不要把所有后端逻辑写进 Next.js。采用以下分层：

```text
浏览器
  |
Next.js Web Console + BFF
  |
API Gateway / Auth
  |
OpenClaw-style Gateway
  |-- Agent Runtime
  |-- Session Manager
  |-- Skill Registry
  |-- Tool Policy Engine
  |-- Approval Service
  |-- Channel Router
  |-- Plugin Manager
  |
Worker / Workflow Runtime / Sandbox
  |
PostgreSQL + Redis + Object Storage + Vector Database
```

对应 OpenClaw 的概念：

| OpenClaw 概念 | 本项目实现 |
|---|---|
| Gateway | 统一控制面、鉴权、路由、事件和连接管理 |
| Agent Runtime | Agent 上下文、模型循环、Skill 和工具调用 |
| Skill | 可审核、可版本化、可组合的能力积木 |
| Plugin | 渠道、模型、工具、知识库和外部系统扩展 |
| Channel | WebChat、API、企业微信、钉钉、飞书等入口 |
| Node | 浏览器、桌面、移动设备或企业内部执行节点 |
| Workspace | Agent 专属文件、提示词、配置和输出空间 |

## 二、技术栈

### Web 前端

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui 或同等企业级组件库
- TanStack Query
- Zustand，仅用于轻量客户端状态
- React Hook Form + Zod
- WebSocket 或 SSE 展示 Agent 流式事件
- Playwright 进行端到端测试

### 后端服务

- TypeScript
- NestJS 或 Fastify
- REST API + WebSocket
- PostgreSQL
- Prisma 或 Drizzle ORM
- Redis：缓存、队列、分布式锁和限流
- BullMQ 或同等任务队列
- S3 兼容对象存储
- pgvector、Milvus 或同等向量数据库
- OpenTelemetry + Prometheus + Grafana

### 部署

- 本地开发：Docker Compose
- 测试环境：容器化部署
- 生产环境：Kubernetes
- Nginx 或云负载均衡
- HTTPS/WSS
- CI/CD、数据库迁移、备份和灾难恢复

生产部署至少包含：HTTPS/WSS 负载均衡 -> Next.js Web/BFF、API、Gateway；Gateway 将运行任务投递到 Agent Runtime/Worker；高风险工具进入 Sandbox Runner；状态和业务事实进入 PostgreSQL，缓存/锁/队列加速进入 Redis，文件进入 S3 兼容存储，向量检索进入 pgvector 或独立向量库。Redis 队列必须有持久化、死信和恢复策略，不能作为 Run、审批或审计的唯一事实源。副本数、CPU 和内存必须通过 Helm/环境配置和容量压测决定，不能在 Prompt 中写死“固定几副本”。

### Model Provider 抽象

模型供应商必须通过统一适配器接入，Agent 不得直接依赖某一家 SDK：

```ts
type ModelProviderDefinition = {
  id: string;
  name: string;
  type: "anthropic" | "openai" | "azure" | "bedrock" | "custom";
  endpoint?: string;
  authType: "api_key" | "oauth" | "aws_iam";
  secretId: string;
  models: Array<{
    modelId: string;
    displayName: string;
    contextWindow: number;
    supportsStreaming: boolean;
    supportsToolUse: boolean;
    inputCostPer1kTokens: number;
    outputCostPer1kTokens: number;
  }>;
};

type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string };
type ModelEvent =
  | { type: "text.delta"; text: string }
  | { type: "tool.call"; toolId: string; input: unknown }
  | { type: "completed"; inputTokens: number; outputTokens: number };
type UsageSummary = { inputTokens: number; outputTokens: number; costCents: number };

interface ModelService {
  stream(input: {
    providerId: string;
    modelId: string;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
    maxTokens?: number;
  }): AsyncIterable<ModelEvent>;
}
```

至少提供 Anthropic 和 OpenAI 适配器；Azure、Bedrock 和自定义兼容接口作为后续适配器。所有适配器统一输出 `ModelEvent`，凭据只通过 Secret Manager 的 `secretId` 获取。

### 测试策略

- 单元测试：Vitest，覆盖 Schema、权限、Agent Runtime、Tool executor，核心模块目标 80%+。
- 集成测试：Vitest + Testcontainers，覆盖 API、数据库仓储、Redis、WebSocket 和模型 Mock。
- 端到端测试：Playwright，覆盖登录 -> 创建 Agent -> 添加 Skill -> 测试 -> 发布、跨租户拒绝和高风险审批。
- 性能测试：阶段 7 使用 k6 验证并发对话、WebSocket 连接、队列和数据库慢查询。
- 所有模型测试默认使用 Mock，不把真实供应商调用作为 CI 必需条件。

### 可观测性

至少提供以下指标：`agent_run_total`、`agent_run_duration_seconds`、`agent_run_tokens_total`、`agent_run_cost_cents`、`tool_execution_total`、`approval_pending_count`、`websocket_connections_active`、`model_api_latency_seconds`、`queue_job_duration_seconds`。

至少配置以下告警：5 分钟运行失败率超过 5%、模型错误率超过 10%、队列积压超过 1000、数据库查询超过 1 秒、单日成本超过预算 150%。指标标签必须控制基数，禁止把原始用户输入、Token 或密钥写入指标。

## 三、Next.js 的职责边界

Next.js 只负责：

1. 企业级管理后台和用户工作台。
2. 登录页、Agent 管理、Skill 市场、测试工作台和审计页面。
3. Server Components 用于安全读取和首屏渲染。
4. Client Components 用于表单、聊天、工作流画布和实时状态。
5. BFF 层用于浏览器请求聚合、Cookie 会话和服务端鉴权。
6. API Route 只处理轻量 BFF，不执行长时间 Agent 任务。

以下逻辑必须放在独立后端：

- Agent Runtime
- Gateway WebSocket 长连接
- 模型调用
- 工具执行
- 浏览器自动化
- 文件解析
- RAG 索引
- 工作流和长任务
- 审批队列
- 代码或命令沙箱

## 四、推荐项目目录

```text
agent-platform/
  apps/
    web/                         # Next.js 管理后台和用户工作台
    gateway/                     # OpenClaw 风格 Gateway
    api/                         # 企业业务 API、租户、用户、权限、审计
    worker/                      # 异步任务、文档处理、RAG、工作流
    sandbox-runner/              # 隔离的工具和代码执行服务
  packages/
    agent-core/                  # Agent 循环、上下文和运行时契约
    protocol/                    # REST/WS 事件、请求和响应类型
    schemas/                     # Zod/JSON Schema 定义
    skill-sdk/                   # Skill 创建和验证 SDK
    plugin-sdk/                  # Plugin 扩展 SDK
    tool-sdk/                    # 工具注册、权限和执行契约
    auth/                        # 认证和授权共享模块
    database/                    # ORM、迁移和仓储
    observability/               # 日志、指标、Trace
    ui/                          # 前端共享组件
  infra/
    docker/
    kubernetes/
    terraform/
  docs/
  tests/
```

## 五、核心领域模型

设计以下实体，并为每个实体提供数据库表、Schema、仓储、API、审计事件和测试：

- Tenant：租户
- Organization：组织
- User：用户
- Team：团队
- Role / Permission：角色和权限
- Agent：Agent 定义
- AgentVersion：Agent 版本
- Skill：Skill 元数据
- SkillVersion：Skill 版本
- Tool：工具定义
- ToolPolicy：工具权限策略
- Plugin：插件
- KnowledgeBase：知识库
- KnowledgeDocument：知识文档
- Conversation：会话
- Run：Agent 运行实例
- ApprovalRequest：审批请求
- Channel：消息渠道
- Binding：渠道到 Agent 的路由绑定
- Workflow：工作流
- AuditEvent：审计事件
- UsageRecord：调用、Token、成本和延迟记录

所有租户相关表必须包含 `tenantId`，查询必须强制带租户范围。不能依赖前端传入租户 ID 作为安全依据。

### 权限模型

权限采用 `resource:action:scope` 形式：资源为 `agent`、`skill`、`tool`、`knowledge_base`、`conversation` 或 `workflow`；操作为 `create`、`read`、`update`、`delete`、`execute`、`publish` 或 `approve`；范围为 `own`、`team`、`tenant` 或 `all`。

内置角色至少包括：

- `tenant_admin`：租户内管理权限，但仍受平台安全策略约束。
- `agent_creator`：创建和维护自己的 Agent，可读取团队 Skill。
- `agent_user`：使用团队已发布 Agent，不能修改配置。
- `skill_admin`：创建、审核、发布和回滚租户 Skill。

API 鉴权顺序固定为：验证 Token -> 得到服务端 userId/tenantId -> 加载用户全部角色 -> 合并权限 -> 检查 resource/action/scope -> 对 `own` 资源验证 `createdBy`。禁止信任客户端传入的 `tenantId`、角色或权限字段。

### 数据库分期

- 阶段 0.2：Tenant、User、Role、Permission、Agent 五张核心表。
- 阶段 1：补充 Team、Skill、Tool、ToolPolicy、Conversation、Message、Run。
- 阶段 2：补充 AgentVersion、SkillVersion、ApprovalRequest、UsageRecord、AuditEvent。
- 阶段 3：补充 KnowledgeBase、KnowledgeDocument、Workflow。
- 阶段 4：补充 Channel、Binding、Plugin、Organization。
- 阶段 5 以后：按实际功能增加模型供应商、配额、计费、模板和市场表。

每次迁移必须可回滚；阶段早期只实现当前阶段需要的表，不提前创建无法验证的完整数据库。

## 六、AgentDefinition Schema

Agent 只能通过结构化 Schema 创建，禁止直接执行用户上传的任意 JSON 或 Prompt：

```ts
type AgentDefinition = {
  id: string;
  tenantId: string;
  displayName: string;
  description: string;
  avatar?: string;
  persona: string;
  goals: string[];
  outputContract: {
    format: "text" | "markdown" | "json" | "table" | "document";
    schema?: unknown;
  };
  model: {
    providerId: string;
    modelId: string;
    temperature?: number;
    maxTokens?: number;
  };
  skillRefs: Array<{ skillId: string; version: string }>;
  toolRefs: Array<{ toolId: string; policyId: string }>;
  knowledgeBaseRefs: string[];
  workflow?: WorkflowGraph;
  channelBindings: string[];
  approvalPolicy: ApprovalPolicy;
  limits: {
    maxRunSeconds: number;
    maxTokensPerRun: number;
    dailyBudgetCents: number;
    maxConcurrency: number;
  };
  status: "draft" | "testing" | "published" | "paused" | "archived";
  version: string;
};
```

使用 Zod 或 JSON Schema 在 API、数据库写入、发布和运行前分别校验。发布后的版本必须不可变，只能创建新版本。

### Agent 依赖类型

```ts
type ApprovalAction = "auto" | "ask" | "deny";
type ApprovalPolicy = {
  defaultAction: ApprovalAction;
  rules: Array<{
    toolId?: string;
    permission?: string;
    sideEffect?: "file-write" | "network" | "external-send" | "device";
    action: ApprovalAction;
    approvers?: string[];
    timeoutSeconds?: number;
  }>;
};

type WorkflowNode =
  | { type: "start" | "end"; id: string }
  | { type: "agent"; id: string; agentId: string }
  | { type: "skill"; id: string; skillId: string }
  | { type: "tool"; id: string; toolId: string; params: unknown }
  | { type: "condition"; id: string; expression: string }
  | { type: "approval"; id: string; approvers: string[] };
type WorkflowEdge = { from: string; to: string; condition?: string };
type WorkflowGraph = { nodes: WorkflowNode[]; edges: WorkflowEdge[]; entryNodeId: string };
```

`expression` 必须使用受限表达式语言或预编译规则，禁止直接执行 JavaScript。

## 七、Skill 系统

Skill 必须是可审核的能力包，不只是任意 Markdown：

```ts
type SkillDefinition = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  category: string;
  instruction: string;
  inputSchema: unknown;
  outputSchema: unknown;
  requiredTools: string[];
  requiredPermissions: string[];
  sideEffects: Array<"none" | "file-write" | "network" | "external-send" | "device">;
  riskLevel: "low" | "medium" | "high" | "critical";
  examples: unknown[];
  dependencies: string[];
  visibility: "private" | "team" | "tenant" | "public";
};
```

必须支持 Skill 创建、上传、审核、发布、下架、版本、依赖、测试、评分、安装、升级、回滚和使用统计。

Skill 加载规则要参考 OpenClaw：工作区 Skill 优先于项目 Skill，项目 Skill 优先于托管 Skill；同名冲突必须可解释，并在运行详情中显示最终加载了哪个版本。

## 八、Tool 系统

Tool 是 Agent 可以调用的原子能力。Tool 必须拥有结构化输入输出、权限声明和可审计的执行边界：

```ts
type ToolDefinition = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: "file" | "network" | "data" | "communication" | "system" | "device";
  inputSchema: unknown;
  outputSchema: unknown;
  requiredPermissions: string[];
  sideEffects: Array<"none" | "file-write" | "network" | "external-send" | "device">;
  riskLevel: "safe" | "medium" | "high" | "critical";
  executor: "builtin" | "plugin" | "sandbox";
  timeoutSeconds: number;
  retryPolicy?: { maxRetries: number; backoff: "fixed" | "exponential" };
  sandboxed: boolean;
  auditFields: string[];
  version: string;
};
```

Tool 执行流程：Runtime 解析模型的工具调用 -> 查找并校验 `ToolDefinition.inputSchema` -> 检查 `ToolPolicy` -> 根据 `ApprovalPolicy` 自动执行、请求审批或拒绝 -> 路由到 executor -> 校验输出 -> 写入审计 -> 将结果返回模型。输入输出 Schema 必须使用 JSON Schema 方言并在运行时真正校验，不能只写在类型注释中。

## 九、Gateway 和 Agent Runtime

Gateway 是平台唯一的控制面，负责：

- 身份认证和租户识别
- Agent 路由和 Channel 绑定
- 会话创建和恢复
- Skill 快照加载
- Tool Policy 检查
- 审批请求
- WebSocket/SSE 事件推送
- 运行取消、超时和重试
- 审计和用量记录

Agent Runtime 负责：

1. 读取已发布的 AgentVersion。
2. 创建隔离的运行上下文。
3. 加载 Skill、工具、知识库和会话历史。
4. 组装系统提示词和结构化输入。
5. 调用模型。
6. 解析模型的工具调用意图。
7. 重新执行权限检查。
8. 自动执行、请求人工审批或拒绝。
9. 处理工具结果、上下文压缩、重试和超时。
10. 输出流式事件并持久化完整运行轨迹。

## 十、实时协议

WebSocket 连接必须先完成鉴权握手。事件采用版本化结构：

```ts
type AgentEvent =
  | { type: "run.accepted"; runId: string }
  | { type: "message.delta"; runId: string; text: string }
  | { type: "skill.started"; runId: string; skillId: string }
  | { type: "tool.approval.required"; requestId: string; summary: string }
  | { type: "tool.started"; runId: string; toolId: string }
  | { type: "tool.completed"; runId: string; toolId: string; result: unknown }
  | { type: "run.completed"; runId: string; usage: UsageSummary }
  | { type: "run.failed"; runId: string; code: string; message: string };
```

事件必须具备 `eventId`、`runId`、`tenantId`、`timestamp`、`sequence` 和协议版本。客户端断线后支持从 sequence 恢复，而不是重复执行工具。

## 十一、非专业用户 Agent 创建向导

Next.js 前端实现以下步骤：

1. 选择岗位模板：客服、销售、研究、写作、数据分析、招聘、项目管理等。
2. 填写名称、服务对象、目标和期望输出。
3. 通过 Skill 卡片选择“会什么”，隐藏底层技术术语。
4. 选择知识库和数据范围。
5. 配置模型和预算，提供合理默认值。
6. 用开关配置文件、网络、API、设备和消息权限。
7. 用自然语言配置行为规则，后台转换为结构化策略。
8. 设置高风险动作的审批策略。
9. 选择 Web、API、企业微信、钉钉、飞书等入口。
10. 在测试工作台上传脱敏样例，查看完整工具调用时间线。
11. 发布前展示 Skill、数据、权限、风险、成本和外发动作摘要。
12. 发布为个人 Agent、团队 Agent 或可复用模板。

前端必须有加载、空状态、错误、无权限、审批等待、运行失败和断线恢复状态。不能只实现成功路径。

## 十二、工具和审批

每个 Tool 必须声明参数 Schema、输出 Schema、权限、风险等级、副作用、超时、重试和审计字段。

默认策略：

- 读取用户主动提供的文件：允许
- 写入专用输出目录：允许
- 覆盖原文件：必须确认
- 访问外部网络：按域名白名单
- 发送邮件或群消息：必须确认
- 删除文件：默认禁止
- 执行 Shell：默认禁止，必须进入隔离沙箱
- 支付、交易、权限变更：默认禁止并要求管理员策略

权限检查必须在模型决定调用工具后再次执行，不能只在页面上做开关控制。

## 十三、知识库和工作流

支持 PDF、Word、Excel、PPT、Markdown、网页和数据库；实现文档解析、分块、向量化、全文检索、混合检索、元数据过滤、引用来源和权限过滤。

工作流节点包括开始、输入、Agent、Skill、Tool、条件、并行、循环、延迟、Webhook、人工审批和结束。必须设置最大循环次数、最大运行时间、预算和递归深度，防止 Agent 互相调用造成失控。

## 十四、企业安全基线

必须实现：

- 多租户隔离和行级访问控制
- RBAC，预留 ABAC
- OIDC/OAuth2、企业 SSO 接口
- MFA 和管理员二次认证
- HTTPS/WSS
- Secret Manager，不在前端和日志保存密钥
- 敏感字段加密和日志脱敏
- Prompt Injection 防护
- SSRF、XSS、CSRF、SQL 注入和路径穿越防护
- 上传文件类型、大小和恶意文件检查
- Tool allowlist、域名 allowlist 和命令沙箱
- 速率、并发、Token、成本和配额限制
- 审批、拒绝、撤销和紧急停用
- 不可篡改审计日志
- 数据留存、导出、删除和备份恢复
- Skill/Plugin 信任等级、依赖扫描和签名预留
- 私有化、内网和网络隔离部署能力

所有外部输入，包括用户消息、网页、附件、Skill 内容、Plugin 输出和模型输出，都必须按不可信数据处理。

## 十五、前端页面

使用 Next.js App Router 实现：

- 登录和组织选择
- 首页仪表盘
- Agent 列表、详情、创建向导、版本和发布
- Agent 测试工作台和运行时间线
- Skill 市场、详情、审核和版本
- Tool 管理和权限策略
- 知识库和文档权限
- 可视化工作流编辑器
- Channel 和 Binding 管理
- 用户、团队、角色和租户管理
- 审批中心
- 审计日志
- 成本、Token、延迟和错误报表
- 模型供应商和 Secret 配置
- 安全中心和系统设置

组件必须支持键盘操作、响应式布局、错误边界、权限隐藏和服务端鉴权。敏感数据只在需要时由服务端读取。

### 核心页面交互要求

至少实现以下页面的可验收交互：

1. `/login`：邮箱密码登录、账号停用和租户过期错误、SSO 入口预留、登录失败不泄露账号是否存在。
2. `/`：我的 Agent、最近会话、调用次数、Token、成本、待审批数量和快速创建入口；所有统计按当前租户权限聚合。
3. `/agents`：我的/团队/模板 Tab，搜索防抖、状态和标签筛选、分页、卡片/列表切换，以及测试、编辑、复制和带确认删除。
4. `/agents/create`：七步向导，任何步骤可保存草稿；Skill 卡片显示权限、风险、依赖和版本；发布前展示数据范围、外发动作、预算和审批摘要。
5. `/agents/[id]/test`：聊天、文件上传、停止运行、断线恢复；右侧显示 Skill、Tool、审批、错误和 Token/成本时间线。
6. `/skills`：分类、风险、来源和版本筛选；详情页显示权限、副作用、依赖、示例、审核状态和安装/回滚操作。
7. `/approvals`：待我审批、我发起的和全部 Tab；审批卡片展示发起人、Agent、Tool 输入摘要、风险、上下文、超时和批准/拒绝原因。
8. `/audit`：按时间、用户、Agent、事件和风险筛选；详情默认脱敏；导出操作需权限并写入审计。

所有页面必须具备 Skeleton、空状态、错误重试、403 状态、键盘操作、响应式布局和错误边界。中文是默认语言，保留 i18n 结构。

## API 端点设计

API 统一使用 `/api/v1` 前缀、分页游标、请求关联 ID 和结构化错误响应。以下是最小端点集，最终以 OpenAPI 为准：

```text
认证：POST /auth/login、POST /auth/logout、POST /auth/refresh、GET /auth/me
Agent：GET/POST /agents、GET/PATCH/DELETE /agents/{id}、POST /agents/{id}/publish、POST /agents/{id}/versions、POST /agents/{id}/rollback
Skill：GET/POST /skills、GET/PATCH /skills/{id}、POST /skills/{id}/publish、POST /skills/{id}/approve
会话：GET/POST /conversations、GET /conversations/{id}/messages、POST /runs、GET /runs/{id}、POST /runs/{id}/cancel
审批：GET /approvals、POST /approvals/{id}/approve、POST /approvals/{id}/reject
审计：GET /audit、GET /audit/export
用量：GET /usage/summary、GET /usage/agents/{id}
实时：WS /gateway/ws（鉴权握手后接收 AgentEvent）
```

删除、发布、回滚、审批和导出均要求服务端权限检查、幂等键或并发版本检查，并记录审计。

### 错误码规范

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Agent not found",
    "requestId": "req_123",
    "details": {}
  }
}
```

错误码统一使用 `10-shared-contracts.md` 定义的无前缀稳定枚举，例如 `UNAUTHORIZED`、`FORBIDDEN`、`NOT_FOUND`、`CONFLICT`、`BUDGET_EXCEEDED` 和 `VALIDATION_ERROR`。对外 message 不暴露堆栈、SQL、供应商密钥或跨租户资源是否存在；跨租户查询返回 `NOT_FOUND`，已定位资源但动作不允许返回 `FORBIDDEN`。

### 核心 Prisma Schema 参考

以下只是阶段 0.2 的最小契约示例，不是一次性实现全部领域表；认证凭据应放在独立的 Secret/Identity 存储中，不能把明文密码放入 `User`：

```prisma
model Tenant {
  id        String   @id @default(cuid())
  slug      String   @unique
  name      String
  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users     User[]
  agents    Agent[]
  roles     Role[]
}

model User {
  id          String   @id @default(cuid())
  tenantId    String
  email       String
  displayName String
  status      String   @default("active")
  createdAt   DateTime @default(now())
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  roles       UserRole[]
  @@unique([tenantId, email])
  @@index([tenantId])
}

model Role {
  id       String @id @default(cuid())
  tenantId String?
  name     String
  isSystem Boolean @default(false)
  tenant   Tenant? @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  users    UserRole[]
  permissions RolePermission[]
  @@unique([tenantId, name])
}

model Permission {
  id      String @id @default(cuid())
  resource String
  action   String
  scope    String
  roles    RolePermission[]
  @@unique([resource, action, scope])
}

model Agent {
  id          String @id @default(cuid())
  tenantId    String
  createdBy   String
  displayName String
  status      String @default("draft")
  definition  Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenant      Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId, status])
  @@index([tenantId, createdBy])
}

model UserRole { userId String; roleId String; user User @relation(fields: [userId], references: [id], onDelete: Cascade); role Role @relation(fields: [roleId], references: [id], onDelete: Cascade); @@id([userId, roleId]) }
model RolePermission { roleId String; permissionId String; role Role @relation(fields: [roleId], references: [id], onDelete: Cascade); permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade); @@id([roleId, permissionId]) }
```

### 安全威胁模型

| 威胁场景 | 必须的防护 | 首次落地 |
|---|---|---|
| Prompt Injection：用户、网页或附件伪造系统指令 | 分离 system/user/context；对外部内容加不可信边界标记；工具调用仍需策略检查 | 阶段 2，阶段 4 增强 |
| 跨租户数据泄漏 | 服务端从 Token 得到 tenantId；所有查询带租户范围；仓储层强制注入；越权写审计 | 阶段 0.2/1 |
| 工具调用越权 | 模型 tool call 不能提升权限；Runtime 二次检查 ToolPolicy；高风险审批超时拒绝 | 阶段 2/4 |
| 成本失控或无限循环 | maxTokens、maxRunSeconds、递归深度、循环次数、预算和 Redis 限流熔断 | 阶段 2/4 |
| 敏感信息进入日志和指标 | 日志脱敏；`auditFields` 只记录哈希或摘要；指标禁止原始输入 | 阶段 1/4 |
| 恶意 Skill/Plugin | 发布前审核、依赖扫描；Plugin 独立进程或沙箱；只能通过受控 Gateway API 访问 | 阶段 3/6 |
| SSRF 和内网探测 | web_fetch 默认拒绝内网、环回、云元数据和 `file://`；域名白名单和 DNS 解析后复核 | 阶段 2/4 |

威胁模型必须作为测试用例和审计事件的一部分维护，不能只停留在文档列表。

## 十六、分阶段实施

### 阶段 0.1：核心类型和 Monorepo 骨架

创建 Turborepo/pnpm workspace，完成 `packages/schemas`、`packages/protocol`、`packages/agent-core` 的核心类型、Zod Schema、API DTO 和 WebSocket 事件类型。输出最小 ADR 和安全威胁模型。

验收：`pnpm install`、`pnpm build` 成功；其他 package 可以导入核心类型；Schema 单元测试通过；不开始大规模 UI 编码。

### 阶段 0.2：技术栈垂直切片验证

创建 `apps/web`、`apps/api`、`apps/gateway` 的最小可运行版本，以及 PostgreSQL、Redis 的 Docker Compose。API 提供 `/health`，Next.js 页面调用 API 并展示状态，NestJS/Fastify 完成一次 PostgreSQL 查询。

验收：`docker compose up`、`pnpm dev` 成功；浏览器访问 `localhost:3000`；页面能得到 `{ "status": "ok" }`；数据库迁移可执行和回滚。

阶段 0.2 验收测试：健康检查返回 200；Next.js 服务端调用 API 时携带关联 ID；数据库迁移完成后可回滚；未登录请求得到 401；不同租户上下文不能读取对方数据。

### 阶段 1：Next.js Web 骨架和企业身份

实现 Next.js 管理后台、登录、租户、用户、角色、Agent/Skill 列表和基础 API。实现阶段 0.2 的五张核心表，不提前实现全部领域表。

验收：用户登录后只能看到自己租户的数据，页面具备加载、空、错误和无权限状态。

阶段 1 验收测试：用户登录并刷新后会话仍有效；用户只能看到当前租户的 Agent；`own` 权限不能修改他人 Agent；重复邮箱仅在同一租户内冲突；停用用户不能创建会话。

### 阶段 2：Gateway 和最小 Agent Runtime

实现一个模型供应商适配器、会话、WebSocket/SSE 流式输出、Skill 加载、一个只读工具和运行记录；新增 Conversation、Message、Run、Skill、Tool、ToolPolicy 表。

验收：用户可以在 WebChat 与 Agent 对话，看到 Skill 和工具事件，失败可定位。

阶段 2 验收测试：Mock 模型返回流式 `message.delta`；Skill 加载产生 `skill.started`；只读 Tool 的输入输出通过 Schema；模型返回 429 时 Run 进入 `failed` 且不无限重试；客户端断线后按 sequence 恢复而不重复执行 Tool。

### 阶段 3：可视化 Agent 组装

实现创建向导、Skill 卡片、权限配置、审批策略、测试工作台、草稿/发布/回滚；新增版本、审批、用量和审计表。

验收：非专业用户不写代码即可创建、测试和发布 Agent。

阶段 3 验收测试：向导可保存草稿并恢复；高风险 Skill 显示权限摘要；发布前缺少必填字段时阻止发布；发布版本不可直接修改；回滚后新运行使用目标版本。

### 阶段 4：企业安全和治理

实现 RBAC、Secret Manager、工具策略、沙箱、限流、配额、成本熔断和敏感数据防护；审计、审批和用量表在上一阶段已有最小版本，本阶段完善不可篡改存储、查询和告警。

验收：高风险动作必须审批，跨租户访问和越权工具调用均被拒绝并记录。

阶段 4 验收测试：跨租户 Agent、会话和知识库查询返回 `404 NOT_FOUND`；已定位资源的越权动作返回 `403 FORBIDDEN`；越权 `write_file` 调用在 Runtime 第二次检查时被拒绝；审批超时自动拒绝；日志和指标不包含原始敏感字段；超过预算后 Run 熔断。

### 阶段 5：知识库和工作流

实现 RAG、权限过滤、引用来源、可视化工作流和多 Agent 协作。

验收：Agent 只使用授权资料，工作流可暂停、恢复、重试和取消。

### 阶段 6：Channel、Plugin 和 Node

实现 API、Webhook 和一个企业消息渠道，再提供 Plugin SDK、Channel SDK 和 Node 接入协议。

验收：消息可正确绑定到 Agent，插件可独立安装、停用、升级和审计。

### 阶段 7：生产化

实现高可用、队列扩展、容器部署、监控告警、备份恢复、灰度发布、灾难演练和私有化部署文档。

验收：每个服务可独立扩展，故障可观测、可恢复，版本可回滚。

## 十七、开发纪律

每次只实现一个阶段。开始编码前先输出该阶段目标、文件变更、数据迁移、API、测试和验收标准。完成后必须报告实际修改文件、测试命令、测试结果、已知问题和下一阶段计划。

不要生成无法维护的单体文件，不要把权限检查留给前端，不要把任意用户配置直接当代码执行，不要把未实现的功能描述成已完成。所有功能必须有类型、错误处理、日志、测试和安全边界。

最终产品必须达到：非专业用户可以通过选择 Skill 和配置岗位安全组装 Agent；企业管理员可以统一管理 Agent、Skill、工具、权限、渠道、知识库、审批、审计、成本、版本和部署。
