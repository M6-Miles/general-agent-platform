# API 文档覆盖情况

由 `python scripts/openapi_diff.py` 生成/复核。

- 已文档化：55 个公开 API paths。
- 运行时路由：63 个 paths（55 个公开路径和 8 个框架/运维内部路径）。
- 未文档化业务路由：0。
- 可排除的内部路由：`/health`、`/ready`、`/metrics`、`/docs`、`/redoc`、`/openapi.json`

当前合同测试保证所有已声明路径都存在且响应/共享 schema 约定有效；未声明路径不会被误判为合同覆盖。差异明细请运行：

```powershell
python scripts/openapi_diff.py
```
