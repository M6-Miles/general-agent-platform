# OpenAPI 覆盖决策

`python scripts/openapi_diff.py` 当前显示 19 个运行时业务路由尚未进入 `project/docs/openapi/openapi.yaml`。这些路由属于已实现的补充能力（Agent 版本/回滚、Run 事件与重放、Skill、DLQ、审计导出、成本和配额等），不是运行时缺失。

## 需要补充

在下一次 API 合同评审中，将以下类别纳入公开合同：Agent 详情、版本与回滚、Run 事件/重放、Skill CRUD/审核、DLQ 管理、审计导出、租户用量/配额和成本汇总。

## 内部端点

`/health`、`/ready`、`/metrics` 是运维探针；`/docs`、`/redoc`、`/openapi.json` 是文档工具端点，无需写入业务合同。

## 决策与后续

本批不直接扩展 OpenAPI YAML，避免在未完成产品/架构确认前公开内部或实验性接口。合同测试继续保证现有 16 个声明路径与运行时一致；新增公开端点确定后，应同步 schema、鉴权和错误响应定义。
