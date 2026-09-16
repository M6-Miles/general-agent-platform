# 跨服务共享契约

_负责人：架构委员会｜状态：规范基线｜版本：v1.1｜最后更新：2026-08-24_

---

本文件定义跨 Runtime、API、Worker 和前端共享的最小契约。代码实现应从版本化 JSON Schema/TypeScript 包生成或校验，文档中的类型用于解释语义，不替代运行时校验。

契约包采用独立版本并遵守兼容策略：新增可选字段属于 minor 变更，删除或改变语义属于 major 变更；服务端至少支持一个旧 minor 版本的读取。任何破坏性变更必须同步更新 API、WebSocket、数据库迁移、前端适配和合同测试。

## Runtime 快照

```typescript
type RuntimeSnapshot = {
  schemaVersion: 1;
  snapshotId: string;
  agentVersionId: string;
  definition: AgentDefinition;       // 发布版本的不可变副本
  skills: Array<{
    skillId: string;
    version: string;
    digest: string;                  // 内容哈希
    manifest: SkillManifest;
    instructions: string;
    requiredTools: string[];
  }>;
  toolPolicies: Array<{
    toolId: string;
    action: "auto" | "ask" | "deny";
    approverRoleIds?: string[];
  }>;
  approvalPolicy: ApprovalPolicy;
  createdAt: string;
};
```

快照在 Run 创建时生成并持久化。运行期间禁止重新读取草稿、浮动版本或当前权限配置；权限撤销通过 Runtime 的二次授权检查立即生效。

## 审批令牌

审批令牌使用 CSPRNG 生成的至少 128 bit 随机值，仅保存令牌哈希，不使用 JWT。Redis 只作短期加速，PostgreSQL 保存事实记录。

```typescript
type ApprovalTokenRecord = {
  tokenHash: string;
  runId: string;
  approvalRequestId: string;
  toolCallId: string;
  snapshotId: string;
  expiresAt: string; // 默认 24 小时，可按租户策略缩短
  usedAt: string | null;
};
```

消费必须在数据库事务中以 `used_at IS NULL AND expires_at > now()` 条件原子更新；更新行数为 0 时返回已使用、过期或无效。决策、审批人和令牌消费写入审计事件。

## 预算策略

预算同时按租户周期和单次 Run 计算，金额使用最小货币单位；模型调用前检查，工具调用前再次检查。达到 90% 进入软停止（不再发起新的工具调用），达到硬上限立即取消当前 Run 并记录原因。服务端必须使用供应商实际 usage 回填，不能只依赖客户端上报。

```typescript
type BudgetPolicy = {
  tenant: { period: "calendar_month"; maxTokens: number; maxCostCents: number };
  run: { maxTokens: number; maxCostCents: number; maxDurationSeconds: number; maxToolCalls: number; maxRecursionDepth: number };
  softLimitRatio: number; // 0 < ratio < 1，例如 0.9
};
```

## Checkpoint

Checkpoint 是可恢复事实，包含 `runId`、`attemptId`、`snapshotId`、当前状态/步骤、消息引用、工具调用状态、usage、`checkpointVersion` 和 `createdAt`。大消息、附件和工具输出保存对象存储，Checkpoint 只保存引用及摘要；敏感字段按 `05` 的脱敏规则处理。每次状态转换使用乐观版本号写入，Redis 仅作为带 TTL 的缓存。

## 错误码

错误码按稳定语义维护，不把内部异常类型暴露给客户端：

`UNAUTHORIZED`、`FORBIDDEN`、`NOT_FOUND`、`VALIDATION_ERROR`、`CONFLICT`、`VERSION_CONFLICT`、`RATE_LIMIT_EXCEEDED`、`QUOTA_EXCEEDED`、`BUDGET_EXCEEDED`、`INVALID_STATE_TRANSITION`、`APPROVAL_ALREADY_HANDLED`、`RESUME_WINDOW_EXPIRED`、`MODEL_PROVIDER_ERROR`、`TOOL_EXECUTION_FAILED`、`SANDBOX_TIMEOUT`、`INTERNAL_ERROR`。

跨租户查询的错误语义为 `NOT_FOUND`；资源存在但动作不允许时使用 `FORBIDDEN`。错误码不得在不同服务中重新命名或添加前缀变体。

新增错误码必须同时更新 OpenAPI、客户端映射、合同测试和变更日志。HTTP 映射：认证 401、授权 403、不存在 404、校验 400、冲突 409、状态冲突 422、限流/配额 429、上游故障 502/503、超时 504、内部错误 500。`RESUME_WINDOW_EXPIRED` 在 WebSocket 中作为 `error` 事件发送；在 HTTP 恢复接口中映射为 409，客户端收到后必须重新查询 Run 当前状态，不得继续假设事件流完整。

## Idempotency-Key

写操作接受 UUID v4 或 ULID。键的作用域为 `tenantId + authenticatedPrincipal + method + path + key`，保留 24 小时。服务端先以唯一约束写入 `processing` 占位并保存规范化请求体 SHA-256；并发请求等待或返回 409，完成后缓存状态码、响应体和响应头。相同键不同请求体返回 409；仅缓存确定性响应，失败响应不覆盖成功结果。
