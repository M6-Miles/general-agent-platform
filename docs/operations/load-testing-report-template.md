# 容量压测报告模板

**执行时间**: YYYY-MM-DD HH:MM  
**执行人员**: [姓名]  
**环境**: [开发/测试/预生产]  
**版本**: [Git commit hash]

---

## 执行摘要

| 测试阶段 | 状态 | 通过/失败 |
|---------|------|----------|
| 冒烟测试 | ✅/❌ | [说明] |
| 负载测试 | ✅/❌ | [说明] |
| 压力测试 | ✅/❌ | [说明] |
| WebSocket 测试 | ✅/❌ | [说明] |
| 工作流测试 | ✅/❌ | [说明] |

**总体结论**: ✅ 通过 / ⚠️ 需优化 / ❌ 不通过

---

## 测试结果详情

### 1. 冒烟测试 (Smoke Test)

**配置**:
- VUs: 1
- Duration: 1m
- Target: 验证基本功能

**结果**:
```text
✓ checks.........................: 100.00% ✓ 60       ✗ 0
  data_received..................: XX MB    XX kB/s
  data_sent......................: XX kB    XX kB/s
  http_req_duration..............: avg=XXms min=XXms med=XXms max=XXms p(90)=XXms p(95)=XXms
  http_req_failed................: 0.00%   ✓ 0        ✗ 60
  http_reqs......................: 60      1/s
  iterations.....................: 60      1/s
```

**判定**: ✅ 通过

---

### 2. 负载测试 (Load Test)

**配置**:
- VUs: 50
- Duration: 5m
- Target: P95 < 1000ms, 失败率 < 1%

**结果**:
```text
✓ checks.........................: 100.00% ✓ 15000    ✗ 0
  http_req_duration..............: avg=XXms p(95)=XXms p(99)=XXms
  http_req_failed................: 0.00%   ✓ 0        ✗ 15000
  http_reqs......................: 15000   50/s
```

**关键指标**:
- 吞吐量: XX RPS ✅
- P95 延迟: XX ms ✅
- 失败率: X.XX% ✅
- CPU 使用: XX% ✅
- 内存使用: XX MB ✅

**判定**: ✅ 通过

---

### 3. 压力测试 (Stress Test)

**配置**:
- Stages: 5m:100, 10m:200, 5m:300, 10m:400, 5m:100, 5m:0
- Target: 找出系统极限

**结果**:
```text
  http_req_duration..............: avg=XXms p(95)=XXms p(99)=XXms
  http_req_failed................: X.XX%
  http_reqs......................: XXXXX
```

**性能拐点**:
- 100 VUs: P95=XXms, 失败率=0%
- 200 VUs: P95=XXms, 失败率=0%
- 300 VUs: P95=XXms, 失败率=X%
- 400 VUs: P95=XXms, 失败率=X% ⚠️

**系统极限**: ~XXX VUs (XXX RPS)

**判定**: ✅ 通过 / ⚠️ 需优化

---

### 4. WebSocket 测试

**配置**:
- VUs: 50
- Duration: 3m
- Target: 实时通信稳定

**结果**:
```text
  ws_connecting..................: avg=XXms
  ws_msgs_received...............: XXXX
  ws_msgs_sent...................: XXXX
  ws_sessions....................: 50
```

**判定**: ✅ 通过

---

### 5. 工作流测试

**配置**:
- VUs: 20
- Duration: 5m
- Target: 复杂业务流程

**结果**:
```text
  http_req_duration..............: avg=XXms p(95)=XXms
  http_req_failed................: X.XX%
  workflow_completed.............: XXXX
```

**判定**: ✅ 通过

---

## 资源使用情况

### 应用层

| 指标 | 空闲 | 负载 | 压力 | 状态 |
|------|------|------|------|------|
| CPU 使用率 | X% | XX% | XX% | ✅ |
| 内存使用 | XXX MB | XXX MB | XXX MB | ✅ |
| 活跃连接 | XX | XXX | XXX | ✅ |
| 线程数 | XX | XX | XX | ✅ |

### 数据库层

| 指标 | 空闲 | 负载 | 压力 | 状态 |
|------|------|------|------|------|
| 活跃连接 | X | XX | XX | ✅ |
| QPS | XX | XXX | XXX | ✅ |
| 慢查询数 | 0 | X | X | ✅ |
| 锁等待 | 0 | 0 | 0 | ✅ |

### Redis 层

| 指标 | 空闲 | 负载 | 压力 | 状态 |
|------|------|------|------|------|
| 内存使用 | XX MB | XX MB | XX MB | ✅ |
| 连接数 | X | XX | XX | ✅ |
| OPS | XXX | XXXX | XXXX | ✅ |

---

## 发现的问题

### 问题 1: [问题描述]

**严重程度**: P0/P1/P2/P3  
**影响**: [说明]  
**复现条件**: [说明]  
**解决方案**: [说明]

### 问题 2: [问题描述]

[同上]

---

## 性能优化建议

1. **[优化点 1]**
   - 现状: [说明]
   - 建议: [说明]
   - 预期收益: [说明]

2. **[优化点 2]**
   - 现状: [说明]
   - 建议: [说明]
   - 预期收益: [说明]

---

## 容量规划建议

基于压测结果：

- **单实例容量**: ~XXX RPS
- **推荐并发**: XXX VUs
- **生产部署建议**: 
  - 最小实例数: X
  - 推荐实例数: X
  - 自动扩缩容阈值: CPU > XX% 或 RPS > XXX

---

## 结论与下一步

### 结论

✅/⚠️/❌ [总体评价]

### 下一步行动

1. [ ] [待办事项 1]
2. [ ] [待办事项 2]
3. [ ] [待办事项 3]

---

## 附录

### 测试环境配置

```yaml
硬件:
  CPU: XX cores
  Memory: XX GB
  Disk: XX GB SSD

软件:
  OS: Ubuntu 20.04
  Docker: 20.10.x
  PostgreSQL: 15.x
  Redis: 7.x
  Python: 3.11
  
网络:
  Bandwidth: XX Mbps
  Latency: XX ms
```

### 测试数据

```text
Tenants: XXX
Agents: XXX
Runs: XXX
Knowledge Bases: XXX
Documents: XXX
```

### 命令记录

```bash
# 启动服务
docker-compose -f docker-compose.production.yml up -d

# 执行压测
bash scripts/run_load_tests.sh

# 查看日志
docker logs agent-runtime-api -f
```
