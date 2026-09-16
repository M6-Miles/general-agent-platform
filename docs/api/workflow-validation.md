# 工作流节点校验与错误响应

工作流创建和更新接口会在保存前校验节点运行参数。前端属性面板和后端接口使用同一套字段约束；直接调用 API 时也必须满足这些规则。

## 校验规则

| 节点类型 | 字段 | 规则 |
| --- | --- | --- |
| `model` | `config.prompt` | 必须是非空字符串 |
| `tool` | `config.tool_id` 或 `config.tool_name` | 至少配置一个工具标识 |
| `tool` | `config.input` | 必须是 JSON 对象；省略时按空对象 `{}` 处理 |
| `condition` | `config.left` | 必须是非空字段名 |
| `condition` | `config.right` | 不能为 `null` 或空字符串；数字和布尔值有效 |
| `condition` | `config.true_next` | 必须配置满足分支目标节点 |
| `condition` | `config.false_next` | 必须配置不满足分支目标节点 |

`prepare`、`finalize`、`start` 和 `end` 节点没有必填运行参数。节点配置可以放在 `config` 中；为兼容旧定义，接口也会合并节点根级运行字段。

## 错误响应

违反节点规则时，接口返回 HTTP `422`，错误结构如下：

```json
{
  "error": {
    "code": "WORKFLOW_NODE_INVALID",
    "message": "模型 Prompt 不能为空",
    "requestId": "req_...",
    "details": {
      "node_id": "model-1",
      "field": "prompt"
    }
  }
}
```

客户端应使用 `error.code` 判断错误类别，使用 `error.details.node_id` 和 `error.details.field` 定位编辑器中的节点及字段。不要依赖 `message` 文本作为程序逻辑判断条件。

## 相关接口

- `POST /api/v1/workflows`：创建并校验工作流定义
- `PUT /api/v1/workflows/{workflow_id}`：更新并重新校验节点配置

Playwright 回归场景位于 `playwright/ui-workflow.spec.js`，接口校验测试位于 `tests/test_workflows_api.py`。
