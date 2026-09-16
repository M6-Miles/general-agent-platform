# 密钥轮换 Runbook

## 触发条件

- `scripts/secret_scan.py` 或 CI secret-scan 发现命中；
- 定期轮换（建议不超过 90 天）；
- 人员离职、权限变更或供应商密钥泄露。

## 代码侧检查

```text
python scripts/secret_scan.py
```

扫描会排除 `.env*` 文件，不读取或输出其内容；命中只输出文件位置和脱敏类型。

## 外部轮换步骤

1. 在 Secret Manager/CI Secrets 生成新的 `SECRET_KEY`、Provider API Key、数据库和 Redis 凭据。
2. 先更新预发布环境并重启 API/Worker，确认 `/health`、`/ready` 和登录流程。
3. 撤销旧凭据，确认旧 Token/Provider Key 不再有效。
4. 更新生产 Secret，滚动重启服务并保存审计记录。

## 生产保护

生产环境启动时会拒绝明显弱的 `SECRET_KEY`。不得把真实密钥提交到仓库、日志、镜像或文档。
