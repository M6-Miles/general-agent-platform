# Skill / Tool SDK 设计

_负责人：扩展平台团队｜状态：基线设计｜版本：v1.1｜最后更新：2026-08-24_

---

## Skill 包规范

```text
skill-name/
  SKILL.md
  manifest.json
  schemas/input.json
  schemas/output.json
  examples/
  tests/
  scripts/           # 默认禁止执行，需声明并审核
```

`manifest.json` 声明 id、版本、描述、入口、依赖 Skill/Tool、所需权限、副作用、风险、支持平台和许可证。Skill 内容只描述方法，不获得额外主机权限。版本遵循 SemVer，发布版本不可变。

## Tool 注册契约

Tool 注册包含 id、input/output JSON Schema、required permissions、sideEffects、riskLevel、executor、timeout、retryPolicy、sandboxed 和 auditFields。SDK 提供 `defineTool()`、Schema 校验、策略检查、脱敏审计和测试 Harness。

## 执行器

- builtin：平台内置只读或受控能力。
- plugin：通过受限 Plugin API 执行，不能直接访问数据库。
- sandbox：不可信代码、浏览器和命令在隔离运行器执行。

SDK 不允许 Tool 自己决定租户、用户或权限；执行上下文由 Gateway 注入。Tool 结果必须通过 outputSchema，失败必须返回稳定错误码。副作用 Tool 必须支持幂等键。

## Skill 审核与发布

上传 -> 静态扫描 -> 依赖和许可证检查 -> 权限/副作用审核 -> 沙箱测试 -> skill_admin 审批 -> 签名发布 -> 版本锁定。安装时记录来源、哈希、版本和批准人；升级必须可回滚。

## 供应链与运行时边界

发布物必须生成 SBOM、内容摘要和签名；运行时只允许加载已批准摘要，禁止按浮动标签或远程 URL 直接执行。依赖锁文件、许可证和漏洞结果随版本保存，撤销版本后新 Run 不得加载该版本。

Tool 的能力声明采用 allowlist：网络域名、文件根目录、命令、资源上限和数据出口必须逐项声明。执行器返回 `started/completed/failed/timed_out` 之一，超时后必须终止子进程并回收资源；SDK 不得吞掉取消信号或把异常原样返回用户。

## 验收标准

- 无效 manifest、Schema、依赖或风险声明不能发布。
- Tool 参数和输出在运行时都校验。
- SDK 测试 Harness 可模拟权限拒绝、超时、重试和审批。
- 同一 Skill/Tool 版本在不同 Agent 上可复现加载。
