# WebSocket 协议设计

_负责人：Gateway 团队｜状态：基线设计｜版本：v1.1｜最后更新：2026-08-24_

---

## 连接

客户端连接后第一帧必须是 `connect`，携带短期凭据、协议版本、客户端 ID 和上次收到的 sequence。服务端返回 `hello`，声明支持的事件版本。Token 不放 URL 查询参数。

## 帧格式

```ts
type Frame = {
  version: "1.0";
  eventId: string;
  type: "connect" | "request" | "response" | "event";
  requestId?: string;
  tenantId?: string;
  sequence?: number;
  timestamp: string;
  payload: unknown;
};
```

客户端请求中的 `tenantId`、用户身份和权限均忽略，以握手身份和服务端资源查询结果为准。协议版本采用 `major.minor`，破坏性变更必须升级 major。

## 运行事件

支持 `run.accepted`、`run.started`、`message.delta`、`skill.started`、`tool.approval.required`、`tool.started`、`tool.completed`、`run.completed`、`run.failed`、`run.cancelled`、`heartbeat` 和 `error`。事件必须带 `runId`、`tenantId`、`sequence`、时间戳和协议版本；敏感工具参数只发送脱敏摘要，完整结果通过有权限的 HTTPS 查询获取。

## 可靠性与安全

- 心跳超时关闭连接；客户端指数退避重连并带随机抖动。
- 服务端按租户和用户限制连接数、订阅数、消息大小和发送速率。
- sequence 持久化并支持 `resume`；超出保留窗口返回 `RESUME_WINDOW_EXPIRED`。
- 事件消费按 `eventId` 幂等去重，断线不自动重跑 Run。
- 事件日志至少保留最近 24 小时或一个 Run 的完整生命周期（取较长者）；发送事件前先写入持久化日志。
- `resume` 只能补发有权限且仍在保留窗口内的事件；客户端 ACK 丢失不得导致 Tool 重复执行。
- `hello` 必须声明协议版本和能力，连接、订阅、单消息大小和每用户发送速率有可配置上限。
- 握手和订阅均重新校验租户与资源权限，Origin/CORS 使用白名单。

## 验收标准

- 未完成握手的帧被拒绝。
- 重连可从 sequence 恢复且不重复执行 Tool。
- 无权限用户无法订阅其他租户 Run。
- 心跳、限流、消息过大和服务端错误都有可诊断事件。

## 当前实现状态

MVP 阶段实时事件流采用 SSE（Server-Sent Events）实现，后端当前未暴露 `WS /api/v1/gateway/ws` WebSocket 端点。SSE 满足 Run 事件的服务器到客户端单向推送、断线重连和 sequence 恢复需求，复杂双向 WebSocket 通道作为后续扩展。此决策与 `docs/delivery/known-limitations.md` 的排除项保持一致。
