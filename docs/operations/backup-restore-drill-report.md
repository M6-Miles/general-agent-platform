# Backup and Restore Drill

**执行时间：** 2026-08-28 15:31（Windows Docker Desktop）

## 演练结果

- PostgreSQL 备份：`data/drill-20260828_153110/postgres.dump`，81,000 bytes
- Redis RDB 备份：`data/drill-20260828_153110/redis.rdb`，683 bytes
- 原库 Agent 记录：9
- 独立 PostgreSQL 恢复库 Agent 记录：9
- Redis Stream 测试消息：备份前写入，独立 Redis 恢复后可读，验证通过
- RTO：28.2 秒（备份、独立容器启动、恢复、校验总耗时）
- RPO：0 条测试记录丢失（备份前后 Agent 数量一致，Stream 消息可恢复）
- 完整性校验：✅ 通过

## 执行边界

演练使用独立 PostgreSQL/Redis 容器和临时 volume，完成后清理容器及 volume；原有 Compose 服务未停止。Linux/CI 可执行入口为 `scripts/backup_restore_drill.sh`。本次 Windows 验证使用了等价 PowerShell Docker 命令，因为当前环境没有可用的 WSL `bash`。

## WAL/PITR

本演练使用 PostgreSQL logical custom dump，不等同于 WAL/PITR。生产环境仍需配置归档存储、恢复目标时间点演练、跨可用区副本和保留策略。
