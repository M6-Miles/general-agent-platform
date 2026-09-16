# Worker 故障恢复机制

## 锁与幂等

Worker 使用 Redis `SET NX EX` 获取 `agent-runtime:task-lock:{run_id}`，TTL 固定为 300 秒。Redis 不可用时继续使用数据库行锁和轮询回退。锁释放时校验持有者，避免误删其他 Worker 的锁。

工作流 Tool 调用使用 `tool_name:sha256(input)[:8]:run_id` 作为租户内幂等键；同一 Run 重入时复用已存在调用记录，已完成调用不会重复执行。

## 启动恢复

- `running` 且超过 10 分钟未更新、并且 Redis 锁已过期的 Run 重置为 `accepted`；
- `waiting_approval` 的已批准审批重置为 `accepted`；
- 已拒绝或已过期审批对应 Run 标记为 `cancelled`；
- 所有恢复操作在 Worker 事务中提交，并继续经过既有状态机转换。

## 验证

`tests/test_worker_recovery.py` 覆盖锁冲突、卡住 Run 恢复和审批等待恢复。Redis 不可用时通过数据库回退路径验证，不依赖本机运行 Redis。
