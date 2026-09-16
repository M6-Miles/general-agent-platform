# 多租户与审计字段规则

_负责人：安全与数据平台团队｜状态：契约冻结｜版本：v1.0｜最后更新：2026-08-24_

本文件定义租户隔离和审计字段级规则。数据库、Repository、API、Worker、缓存、对象存储和测试必须遵守；未列出的字段默认不允许跨租户读取。

## 租户上下文

```text
TenantContext = tenantId + principalId + principalType + roles + permissions + requestId + correlationId
```

- `tenantId` 只能来自已验证会话、服务身份或受信任网关上下文；禁止信任 URL、请求体、查询参数和 WebSocket payload 中的租户字段。
- 所有租户业务表必须有非空 `tenant_id`，并建立 `(tenant_id, id)`、状态/时间和业务唯一性索引。
- Repository 方法必须显式接收 `TenantContext` 或 `tenant_id`，禁止提供无 scope 的业务查询方法。
- 缓存键、队列消息、对象存储路径必须包含租户命名空间，例如 `tenant:{tenantId}:run:{runId}`。
- 跨租户查询统一返回 `404 NOT_FOUND`；资源已定位且当前主体无动作权限返回 `403 FORBIDDEN`，两者都写拒绝审计。

## 表级字段规则

| 实体 | 必填隔离字段 | 创建/修改字段 | 版本与追踪字段 | 敏感字段规则 |
|---|---|---|---|---|
| Tenant | `id` | `created_at`, `updated_at`, `deleted_at` | `version` | 密钥不存业务表 |
| User | `id`, `tenant_id` | `created_at`, `updated_at`, `deleted_at` | `version`, `created_by` | 仅保存密码哈希；邮箱按策略脱敏 |
| Agent | `id`, `tenant_id` | `created_at`, `updated_at`, `deleted_at` | `version`, `created_by`, `updated_by` | Prompt/配置按数据分级存储 |
| AgentVersion | `id`, `tenant_id`, `agent_id` | `created_at` | `version`, `published_by`, `published_at`, `content_digest` | 发布内容不可变 |
| ToolCall | `id`, `tenant_id`, `run_id` | `created_at`, `finished_at` | `attempt_id`, `tool_version`, `idempotency_key` | 参数和输出只存脱敏摘要 |
| Run | `id`, `tenant_id`, `conversation_id` | `created_at`, `updated_at`, `finished_at` | `attempt_id`, `checkpoint_version`, `agent_version_id` | 原始 Prompt/附件按敏感级别隔离 |
| ApprovalRequest | `id`, `tenant_id`, `run_id` | `created_at`, `expires_at`, `decided_at` | `snapshot_id`, `decided_by` | 令牌只存哈希 |
| AuditEvent | `event_id`, `tenant_id` | `occurred_at` | `request_id`, `correlation_id`, `schema_version` | 追加写入，禁止普通更新/删除 |

## 审计事件契约

审计事件至少包含：`event_id`、`schema_version`、`tenant_id`、`occurred_at`、`principal_id`、`principal_type`、`action`、`resource_type`、`resource_id`、`result`、`reason_code`、`request_id`、`correlation_id`、`ip_hash`、`user_agent_hash`、`metadata_redacted`。

`metadata_redacted` 只能保存经过字段级脱敏和大小限制的摘要；禁止保存访问令牌、API Key、密码、完整 Prompt、完整工具参数、原始附件和跨租户资源详情。审计写入必须与关键业务状态在同一事务提交，异步投递失败进入重试/死信队列且不得静默丢弃。

## 审计动作与保留

必须记录：登录成功/失败、会话撤销、租户上下文拒绝、Agent 创建/发布/回滚、Tool 注册/执行/拒绝、Run 状态迁移、审批创建/决定/过期、权限变更、敏感导出、配置变更和安全例外。

普通租户管理员只能查询本租户且有权限的审计事件；平台管理员的跨租户查询必须带工单/原因并产生二次审计。默认保留期为 180 天，具体期限由合规策略覆盖；过期归档必须保留完整性校验摘要。删除审计记录只能由受控归档流程执行，不能由业务 API 直接删除。

## 验收标准

- 任一租户查询都不能读到其他租户的 Run、ToolCall、Approval 或 AuditEvent。
- Worker、WebSocket 和缓存路径都能恢复同一 `TenantContext`。
- 权限拒绝、跨租户访问和审计写入失败均有自动化测试与可检索证据。
- 脱敏扫描不能发现 Token、密钥、密码或完整敏感输入。

