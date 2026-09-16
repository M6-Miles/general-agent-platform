# Agent Runtime 设计

_负责人：Runtime 团队｜状态：基线设计｜版本：v1.1｜最后更新：2026-08-24_

---

## 目标与边界

Runtime 负责一次 Agent Run 的上下文构建、模型调用、Skill/Tool 调度、审批暂停恢复、预算控制、流式事件和结果持久化。Gateway 负责连接与路由；API 负责业务 CRUD；Worker 负责长任务；Sandbox 负责不可信执行。Runtime 不直接读取浏览器请求，不直接持有长期密钥。

## 运行生命周期

```text
accepted -> preparing -> running -> waiting_approval -> running
running -> completed | failed | cancelled | timed_out | budget_exceeded
```

每个状态转换必须有合法前置状态、幂等键和审计事件。Run 由 `runId` 唯一标识；重试创建 attempt，不覆盖原始轨迹。

Run 的状态、事件和数据库记录使用同一 `runId + attemptId` 关联；`attempt` 只表示一次执行尝试，不得覆盖原始请求、审批和工具轨迹。所有终态（`completed`、`failed`、`cancelled`、`timed_out`、`budget_exceeded`）必须持久化后才对外发送终态事件。

## 执行步骤

1. 从服务端身份上下文取得 `tenantId/userId`。
2. 读取不可变的已发布 AgentVersion，并生成 Skill/Tool/Policy 快照。
3. 校验输入、附件引用、知识库权限和上下文预算。
4. 组装 system、agent、skill、memory、user 五类上下文；外部内容必须标记为不可信资料。
5. 调用 ModelService，消费 `text.delta`、`tool.call` 和 `completed` 事件。
6. 对每次 tool.call 重新校验 ToolDefinition、ToolPolicy、租户配额和审批策略。
7. 自动执行、创建 ApprovalRequest 或拒绝；审批恢复必须使用一次性 token 和版本号。
8. 校验工具输出，写入脱敏后的 RunTrace，再把结果返回模型。
9. 检查循环次数、递归深度、Token、耗时和预算；达到上限立即停止。
10. 持久化消息、用量、最终状态和审计事件，发送 `run.completed` 或 `run.failed`。

## 上下文与记忆

- 系统规则、租户策略和 AgentVersion 由平台托管，用户不可覆盖。
- Skill 指令按解析后的快照加载，并记录来源与版本。
- 用户文件、网页、RAG 结果统一进入 `untrusted_context` 区域，不得成为系统指令。
- 历史会话按租户、用户、Agent 权限过滤；超出上下文窗口时采用可审计的摘要和裁剪策略。
- 不把完整密钥、原始敏感输入和未经脱敏的工具参数写入 Trace。

## 可靠性规则

- 模型 429/5xx 采用有上限的指数退避；Tool 是否重试由 ToolDefinition 声明。
- 外部副作用 Tool 必须使用幂等键，重试前查询执行记录。
- 客户端断线不取消 Run；取消必须由服务端处理并向 Worker/Sandbox 传播。
- 运行恢复依赖持久化 checkpoint，不依赖进程内内存。

## 关键契约与状态规则

Runtime 快照、审批令牌、预算和 Checkpoint 的字段与存储语义见 [`10-shared-contracts.md`](10-shared-contracts.md)。这里仅规定运行时行为：

| 当前状态 | 允许的下一状态 | 触发条件 |
|---|---|---|
| `accepted` | `preparing`、`cancelled` | Worker 接收或取消 |
| `preparing` | `running`、`failed`、`cancelled` | 快照加载完成或准备失败 |
| `running` | `waiting_approval`、`completed`、`failed`、`cancelled`、`timed_out`、`budget_exceeded` | 工具审批、结果完成、错误、取消或限制 |
| `waiting_approval` | `running`、`failed`、`timed_out`、`cancelled` | 审批通过/拒绝、审批过期或 Run 取消 |

状态转换必须由服务端以 `runId + attemptId + checkpointVersion` 做条件更新；重复事件返回当前状态，不重复执行副作用。终态不可恢复，失败只能创建新的 attempt。审批恢复必须重新检查当前权限，不能仅凭审批时的权限快照放行。

### 模型重试参数

默认仅对 429、500、502、503、504 及明确的网络暂态错误重试：最多 3 次，初始 1 秒、倍增 2、上限 10 秒并加入 20% 随机抖动。流式响应已产生可见副作用后不得盲目重试；Tool 是否可重试由 ToolDefinition 声明，副作用 Tool 重试前必须查询幂等执行记录。

## 验收标准

- Mock 模型可产生流式输出和工具调用。
- 越权工具在 Runtime 第二次校验处被拒绝。
- 审批暂停后可恢复且不会重复执行副作用 Tool。
- 429、超时、预算超限和客户端断线均有确定状态与审计记录。
- 同一个幂等请求重复提交不会创建重复副作用。
