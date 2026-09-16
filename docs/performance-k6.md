# k6 性能测试

性能脚本位于 `tests/performance/`，默认访问本地服务，可通过环境变量覆盖地址。

```bash
k6 run tests/performance/api_load.js --vus 10 --duration 30s
k6 run tests/performance/websocket_load.js --vus 5 --duration 10s
k6 run tests/performance/workflow_load.js --vus 10 --duration 30s
```

`BASE_URL` 设置 REST 服务地址，`WS_URL` 设置 WebSocket 地址，`ACCESS_TOKEN` 可提供受保护 API 的 Bearer Token。阈值要求 API 错误率低于 1%、API 健康检查 P95 小于 1 秒、工作流查询 P95 小于 2 秒，WebSocket 握手成功率高于 99%。当前 MVP 主要提供 SSE；WebSocket 脚本用于部署了 WebSocket 网关的环境。
