# 部署与运维方案

_负责人：SRE 团队｜状态：基线设计｜版本：v1.1｜最后更新：2026-08-24_

---

## 环境

本地使用 Docker Compose（PostgreSQL、Redis、对象存储、向量库）；测试环境与生产使用 Kubernetes。环境配置通过 Secret Manager 和非敏感 ConfigMap 注入，禁止把 `.env` 和真实凭据提交仓库。

## 生产拓扑

```text
Load Balancer (HTTPS/WSS)
  -> Next.js Web/BFF
  -> API Service / Gateway
  -> Agent Runtime / Worker
  -> Sandbox Runner
  -> PostgreSQL / Redis / Object Storage / Vector DB
```

Gateway 和 WebSocket 需要无状态扩展；运行状态、事件 sequence 和锁放在共享基础设施。副本、CPU、内存、连接数和队列并发通过压测、HPA 和容量模型决定，不在文档中写死。

## 发布流程

提交 -> CI 门禁 -> 构建不可变镜像 -> 镜像扫描和签名 -> 测试环境迁移/验收 -> 灰度 -> 监控窗口 -> 全量。数据库采用 expand/migrate/contract；Agent、Skill、Tool 和 API 版本向后兼容并支持回滚。

## 监控与告警

使用 OpenTelemetry Trace、结构化日志、Prometheus 指标和 Grafana Dashboard。监控 Run 成功率、P95/P99 延迟、Token/成本、Tool 拒绝、审批积压、队列深度、数据库连接、Redis、WebSocket、模型错误和 Sandbox 资源。告警包含阈值、持续时间、责任人、Runbook 链接和抑制规则。

## 服务目标

生产环境为每个关键服务登记 SLO、预算和责任人。基线目标：API 可用性 99.9%、Gateway/WebSocket 可用性 99.9%、已接受 Run 的最终状态落库率 99.99%。具体延迟和并发目标由容量压测后写入环境配置；SLO 违反时冻结非必要发布并触发复盘。

## 健康检查

- liveness：进程是否存活，不访问外部依赖。
- readiness：数据库、Redis、必要配置和队列是否可用。
- startup：首次启动迁移/加载是否完成。
- Gateway health：连接数、事件延迟和运行队列状态。

## 备份与灾难恢复

PostgreSQL 使用全量 + WAL/PITR；对象存储启用版本和跨区域策略；Redis 按用途区分可丢缓存与不可丢队列。定义 RTO/RPO，至少季度演练恢复、密钥轮换和区域故障切换。恢复后验证租户、AgentVersion、审计和 Run 一致性。

Redis 中的队列任务必须配置持久化、重试上限、死信队列和恢复演练；Redis 不能作为 Run、审批或审计的唯一事实源。基线 RTO/RPO 为：事务数据库 RTO ≤ 4 小时、RPO ≤ 15 分钟；对象存储 RTO ≤ 8 小时、RPO ≤ 1 小时。正式目标由业务负责人签署后写入灾备 Runbook。

## 发布回滚与变更记录

应用回滚必须验证数据库向后兼容；迁移回滚不得直接删除已被新版本写入的数据。灰度期间保留旧版本事件和 API 兼容窗口，所有生产变更关联变更单、镜像摘要、迁移编号、审批人和回滚结果。

## 运维 Runbook

至少编写模型供应商故障、队列积压、数据库只读、Redis 故障、WebSocket 大面积断线、成本异常、密钥泄露、恶意 Skill、Sandbox 逃逸和数据泄漏的处理步骤。每个 Runbook 包含检测、止损、回滚、通知、取证和复盘。

## 验收标准

- 任一无状态服务可滚动升级，连接和 Run 不丢失。
- 发布失败可回滚应用和数据库兼容变更。
- 备份可在独立环境恢复并通过一致性检查。
- 告警能定位到租户、Agent、Run、服务和版本，但不暴露敏感输入。
