# 容量压测执行指南

## 概述

本文档描述如何执行项目的容量压测，验证系统在预期负载下的性能和稳定性。

## 压测工具

使用 **k6** 作为负载测试工具：
- 轻量级、高性能
- JavaScript 编写测试脚本
- 丰富的指标和报告
- 支持多种负载模式

## 安装 k6

### Windows

```powershell
choco install k6
```

### Linux/macOS

```bash
brew install k6
```

或使用 Docker：

```bash
docker pull grafana/k6
```

## 压测场景

### 1. 健康检查负载测试

**文件**: `tests/performance/api_load.js`

**目标**: 验证基础 API 响应能力

```bash
k6 run tests/performance/api_load.js
```

**默认配置**:
- 失败率 < 1%
- P95 延迟 < 1000ms

### 2. WebSocket 连接测试

**文件**: `tests/performance/websocket_load.js`

**目标**: 验证实时通信能力

```bash
k6 run tests/performance/websocket_load.js
```

### 3. 工作流执行测试

**文件**: `tests/performance/workflow_load.js`

**目标**: 验证复杂业务流程性能

```bash
k6 run tests/performance/workflow_load.js
```

## 执行标准压测

### 阶段 1：冒烟测试（Smoke Test）

验证系统在最小负载下正常运行。

```bash
k6 run --vus 1 --duration 1m tests/performance/api_load.js
```

**目标**:
- ✅ 0 错误
- ✅ 所有检查通过
- ✅ 建立性能基线

### 阶段 2：负载测试（Load Test）

验证系统在预期负载下的表现。

```bash
k6 run --vus 50 --duration 5m tests/performance/api_load.js
```

**目标**:
- ✅ 失败率 < 1%
- ✅ P95 延迟 < 1000ms
- ✅ 吞吐量 ≥ 100 RPS

### 阶段 3：压力测试（Stress Test）

找出系统的极限容量。

```bash
k6 run --stages \
  "5m:100,10m:200,5m:300,10m:400,5m:100,5m:0" \
  tests/performance/api_load.js
```

**阶段说明**:
1. 5min: 0 → 100 VUs（爬坡）
2. 10min: 100 → 200 VUs（增压）
3. 5min: 200 → 300 VUs（持续增压）
4. 10min: 300 → 400 VUs（峰值压力）
5. 5min: 400 → 100 VUs（降压）
6. 5min: 100 → 0 VUs（冷却）

**观察指标**:
- 吞吐量饱和点
- 错误率开始上升的拐点
- 延迟劣化趋势
- 资源使用情况

### 阶段 4：浸泡测试（Soak Test）

验证系统长时间运行的稳定性。

```bash
k6 run --vus 50 --duration 2h tests/performance/api_load.js
```

**目标**:
- ✅ 无内存泄漏
- ✅ 无连接泄漏
- ✅ 性能指标稳定
- ✅ 错误率持续低于阈值

### 阶段 5：峰值测试（Spike Test）

验证系统应对突发流量的能力。

```bash
k6 run --stages \
  "2m:10,1m:100,2m:10,1m:200,2m:10" \
  tests/performance/api_load.js
```

**观察**:
- 突增流量时的响应
- 恢复正常的速度
- 是否有请求丢失

## 压测环境准备

### 1. 启动测试环境

```bash
# 使用生产配置启动
docker-compose -f docker-compose.production.yml up -d

# 等待服务就绪
curl http://localhost:8000/ready
```

### 2. 预热系统

```bash
# 预热缓存和连接池
k6 run --vus 10 --duration 30s tests/performance/api_load.js
```

### 3. 监控准备

确保以下监控就绪：
- Prometheus 抓取指标
- Grafana 仪表盘可访问
- 日志收集正常

## 执行压测

### 完整压测流程

```bash
#!/bin/bash
# 完整压测执行脚本

set -e

BASE_URL="http://localhost:8000"
RESULTS_DIR="load-test-results-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "=== 阶段 1: 冒烟测试 ==="
k6 run --vus 1 --duration 1m \
  --out json="$RESULTS_DIR/smoke.json" \
  tests/performance/api_load.js

echo "=== 阶段 2: 负载测试 ==="
k6 run --vus 50 --duration 5m \
  --out json="$RESULTS_DIR/load.json" \
  tests/performance/api_load.js

echo "=== 阶段 3: 压力测试 ==="
k6 run --stages "5m:100,10m:200,5m:300,10m:400,5m:100,5m:0" \
  --out json="$RESULTS_DIR/stress.json" \
  tests/performance/api_load.js

echo "=== 阶段 4: WebSocket 测试 ==="
k6 run --vus 50 --duration 3m \
  --out json="$RESULTS_DIR/websocket.json" \
  tests/performance/websocket_load.js

echo "=== 阶段 5: 工作流测试 ==="
k6 run --vus 20 --duration 5m \
  --out json="$RESULTS_DIR/workflow.json" \
  tests/performance/workflow_load.js

echo "=== 压测完成 ==="
echo "结果保存在: $RESULTS_DIR"
```

### 使用 Docker 执行

```bash
docker run --rm \
  --network host \
  -v $(pwd):/workspace \
  grafana/k6 run /workspace/tests/performance/api_load.js
```

## 指标分析

### 关键指标

#### 1. HTTP 请求指标

```text
http_reqs..................: 总请求数
http_req_duration..........: 请求延迟分布
  - avg: 平均延迟
  - p(95): P95 延迟（95% 请求低于此值）
  - p(99): P99 延迟
http_req_failed............: 失败率
http_req_rate..............: 吞吐量（RPS）
```

#### 2. 检查指标

```text
checks.....................: 检查通过率
```

#### 3. 迭代指标

```text
iterations.................: 完成的迭代次数
iteration_duration.........: 迭代持续时间
```

### 性能基线

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 失败率 | < 1% | 错误请求占比 |
| P95 延迟 | < 1000ms | 95% 请求响应时间 |
| P99 延迟 | < 2000ms | 99% 请求响应时间 |
| 吞吐量 | ≥ 100 RPS | 每秒请求数 |
| 检查通过率 | 100% | 业务断言通过 |

### 资源监控

压测期间监控以下资源：

#### 应用层

```bash
# CPU 使用率
docker stats --no-stream

# 内存使用
curl http://localhost:8000/metrics | grep process_resident_memory

# 活跃连接
netstat -an | grep 8000 | wc -l
```

#### 数据库层

```sql
-- 活跃连接数
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- 慢查询
SELECT query, calls, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC LIMIT 10;

-- 锁等待
SELECT * FROM pg_locks WHERE NOT granted;
```

#### Redis 层

```bash
# 内存使用
redis-cli info memory

# 命令统计
redis-cli info stats

# 慢日志
redis-cli slowlog get 10
```

## 结果判定

### ✅ 通过标准

- 所有阶段无超时或连接错误
- 失败率 < 1%
- P95 延迟 < 1000ms
- 吞吐量达到目标（≥ 100 RPS）
- 资源使用稳定，无泄漏
- 错误日志无严重异常

### ⚠️ 需优化

- 失败率 1-5%
- P95 延迟 1000-2000ms
- 吞吐量低于预期
- 有偶发错误但可恢复

### ❌ 不通过

- 失败率 > 5%
- P95 延迟 > 2000ms
- 系统崩溃或不可用
- 数据损坏或丢失
- 内存/连接泄漏

## 问题排查

### 高延迟

**可能原因**:
- 数据库慢查询
- 外部 API 超时
- 线程/连接池耗尽

**排查方法**:
```bash
# 查看慢查询日志
tail -f logs/slow-query.log

# 检查 Prometheus 指标
curl http://localhost:8000/metrics | grep duration
```

### 高失败率

**可能原因**:
- 连接池饱和
- 超时配置过短
- 依赖服务不可用

**排查方法**:
```bash
# 检查错误日志
docker logs agent-runtime-api | grep ERROR

# 查看依赖服务状态
curl http://localhost:8000/ready
```

### 内存泄漏

**可能原因**:
- 未关闭的连接
- 大对象缓存未清理
- 循环引用

**排查方法**:
```bash
# 监控内存趋势
watch -n 5 "curl -s http://localhost:8000/metrics | grep process_resident_memory"
```

## 报告生成

### 使用 k6 HTML 报告

```bash
# 安装报告生成器
npm install -g k6-reporter

# 转换为 HTML
k6-reporter load-test-results/stress.json -o report.html
```

### 自定义报告模板

参考 `docs/performance-k6.md` 中的报告模板。

## 持续集成

### GitHub Actions 集成

参考 `.github/workflows/performance.yml` 配置。

### 定期执行

建议频率：
- 每次发布前：完整压测
- 每周：负载测试
- 每月：浸泡测试

## 最佳实践

### 1. 隔离环境

- 使用独立的压测环境
- 避免在生产环境压测
- 确保网络隔离

### 2. 数据准备

- 预置足够的测试数据
- 模拟真实数据分布
- 避免数据竞争

### 3. 逐步加压

- 从小负载开始
- 逐步增加压力
- 观察系统反应

### 4. 监控优先

- 在压测前确认监控正常
- 实时观察关键指标
- 记录异常情况

### 5. 可重复性

- 记录压测配置
- 保存测试结果
- 对比历史基线

## 参考资料

- [k6 Documentation](https://k6.io/docs/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Grafana k6 OSS](https://github.com/grafana/k6)
