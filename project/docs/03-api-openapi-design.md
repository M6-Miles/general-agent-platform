# API / OpenAPI 设计

_负责人：API 团队｜状态：基线设计｜版本：v1.1｜最后更新：2026-08-24_

---

## 总则

API 使用 `/api/v1` 前缀、HTTPS、JSON、RFC 3339 UTC 时间和统一 `requestId`。认证由 HttpOnly Secure SameSite Cookie 或短期 Bearer Token 完成；刷新 Token 轮换并可撤销。所有写操作支持 `Idempotency-Key`，资源更新支持 `If-Match`/版本号。

## 统一响应

```json
{ "data": {}, "requestId": "req_01", "meta": {} }
```

错误格式：

```json
{ "error": { "code": "FORBIDDEN", "message": "Operation is not allowed", "details": {}, "requestId": "req_01" } }
```

错误信息不得暴露 SQL、堆栈、密钥或跨租户资源存在性。

## 最小端点集

```text
GET/POST /api/v1/auth/login|logout|refresh|me
GET/POST /api/v1/agents
GET/PATCH/DELETE /api/v1/agents/{id}
POST /api/v1/agents/{id}/publish|versions|rollback
GET/POST /api/v1/skills
GET/PATCH /api/v1/skills/{id}
POST /api/v1/skills/{id}/approve|publish
GET/POST /api/v1/conversations
GET /api/v1/conversations/{id}/messages
POST /api/v1/runs
GET /api/v1/runs/{id}
POST /api/v1/runs/{id}/cancel
GET /api/v1/approvals
POST /api/v1/approvals/{id}/approve|reject
GET /api/v1/audit
GET /api/v1/usage/summary
GET /api/v1/health|ready
WS /api/v1/gateway/ws
```

## API 行为约束

- 列表接口使用 cursor 分页，限制最大 page size。
- 资源 ID、tenant ID 和角色从服务端上下文获取或校验，不信任请求体。
- 发布、回滚、审批、导出和删除要求权限、审计和幂等。
- 异步 Run 创建返回 `202` 与 `runId`；不让 HTTP 请求长时间等待模型。
- 限流、配额、审计和错误码写进 OpenAPI 描述及示例。

跨租户资源查询返回 `404 NOT_FOUND` 以避免泄露存在性；资源已定位但当前主体缺少动作权限时返回 `403 FORBIDDEN`。该规则同时适用于 HTTP、BFF 和 WebSocket 的资源订阅。

## 共享错误码与幂等实现约束

稳定错误码、HTTP 映射和 `Idempotency-Key` 语义见 [`10-shared-contracts.md`](10-shared-contracts.md)。OpenAPI 必须作为可校验的版本化文件维护；本设计文档描述边界和规则，不把一段未经过 Schema 校验的示例 YAML 当作完整规范。

幂等处理必须先原子抢占唯一键，再执行业务操作，避免两个并发请求同时通过 Redis `GET`。记录请求体哈希并绑定认证主体、租户、方法和路径；相同键不同哈希返回 `409 CONFLICT`。响应缓存应在事务提交后写入，服务重启或 Redis 丢失时可从 PostgreSQL 幂等记录恢复。对于异步 Run，缓存 `202 + runId`，不缓存尚未确定的错误。

## 限流响应

限流算法、配额和窗口由部署环境配置；客户端可依赖以下标准头而不依赖固定数值：`X-RateLimit-Limit`、`X-RateLimit-Remaining`、`X-RateLimit-Reset`，超限时返回 `429 RATE_LIMIT_EXCEEDED` 和 `Retry-After`。限流键至少包含租户、主体和路由，内部管理员不能绕过平台级安全熔断。

## 合同测试门禁

CI 从 OpenAPI 生成 Schema，针对每个公开端点验证成功、校验失败、未认证、跨租户、不存在、冲突和限流响应。合同测试必须覆盖 cursor 分页、`requestId`、错误结构和兼容字段；新增或删除字段先通过兼容性检查，再更新客户端。

## 验收标准

- OpenAPI 能生成 TypeScript 客户端和服务端 DTO。
- 未认证、无权限、Schema 错误、资源不存在、冲突和限流都有稳定错误码。
- 重复 Idempotency-Key 不重复创建 Run 或副作用。
- API 合同测试在 CI 阻止破坏性变更。
