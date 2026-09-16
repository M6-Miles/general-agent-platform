# 部署与故障 Runbook

## 发布前门禁

1. 执行 `python scripts/release_check.py` 和 `python scripts/deployment_check.py`。
2. 执行测试、合同检查、迁移 `upgrade -> downgrade base -> upgrade head` 闭环。
3. 确认镜像摘要、迁移编号、审批人和回滚版本已记录。
4. 在测试环境执行 `scripts/security-smoke.ps1`，确认 `/health`、`/ready` 和未授权 API 结果。

## 常见故障

### 数据库只读或不可用

- 检测：`/ready` 返回 503，检查数据库连接和 PostgreSQL 日志。
- 止损：暂停发布和非必要写入，保留现有 API 副本。
- 恢复：修复主库或切换已验证副本，重新执行 readiness 和 Run 状态一致性检查。
- 取证：保存 requestId、数据库错误、迁移编号和恢复时间。

### Redis 故障或队列积压

- 检测：队列深度、Worker claimed/completed 指标和 Redis 连通性。
- 止损：Worker 使用数据库轮询降级；禁止把 Redis 作为 Run、审批或审计事实源。
- 恢复：修复 Redis 持久化/连接后先消费死信，再恢复正常队列；重复消息依赖 Run/Tool 幂等键去重。

### 模型供应商 429/5xx

- 检测：模型错误指标和 Run 失败审计事件。
- 止损：确认有限重试和熔断生效，必要时切换隔离 Provider。
- 恢复：供应商恢复后逐步放量，检查成本和 token 用量未重复计量。

### 密钥泄露或恶意 Tool

- 止损：立即撤销/轮换密钥，停用 ToolDefinition 或 AgentVersion。
- 取证：保留审计事件、供应链摘要和受影响 Run 列表。
- 恢复：重新扫描依赖和镜像，审批后灰度发布修复版本。

## 回滚

应用回滚必须使用兼容旧 Schema 的镜像；数据库只执行已验证的向后兼容迁移，不直接删除新版本数据。回滚完成后运行安全冒烟、合同检查和 Run 最终状态抽样核对。
