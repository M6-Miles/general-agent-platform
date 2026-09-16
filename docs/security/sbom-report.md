# SBOM 供应链清单

项目提供 `scripts/generate_sbom.py`，使用 Syft 生成 Python 和 Web 依赖清单到 `sbom/`。当前开发环境未安装 Syft，因此尚未生成可签署的正式 SBOM；该项保留为发布门禁。

```powershell
python scripts/generate_sbom.py
```

生产发布还需要对 SBOM 执行漏洞扫描、镜像签名和验签，并将结果作为不可变构建产物保存。
