# SBOM 集成指南

## 概述

本项目已集成 Software Bill of Materials (SBOM) 生成，用于供应链安全审计、漏洞扫描和依赖管理。

SBOM 采用 CycloneDX 标准格式，覆盖 Python 和 Node.js 依赖。

## 自动生成（CI）

每次 CI 运行时自动生成 SBOM：

1. **Python 依赖**：`cyclonedx-bom` 扫描 `requirements.txt`
2. **Node.js 依赖**：`@cyclonedx/cyclonedx-npm` 扫描 `web/package.json`

生成的 SBOM 作为 CI artifact 上传，可从 GitHub Actions 下载。

## 本地生成

```bash
bash scripts/generate_sbom.sh
```

输出文件：
- `sbom/sbom-python.json` - Python 依赖清单
- `sbom/sbom-nodejs.json` - Node.js 依赖清单

## SBOM 用途

### 1. 供应链安全审计

追踪所有直接和传递依赖：
- 依赖来源验证
- 许可证合规检查
- 已知漏洞扫描

### 2. 漏洞管理

与漏洞数据库对比：
- CVE 匹配
- 受影响组件识别
- 修复优先级排序

### 3. 依赖更新跟踪

监控依赖版本：
- 过时依赖识别
- 安全补丁提醒
- 升级影响分析

## 集成工具

### Trivy 漏洞扫描

```bash
trivy sbom sbom/sbom-python.json
trivy sbom sbom/sbom-nodejs.json
```

### Grype 漏洞扫描

```bash
grype sbom:sbom/sbom-python.json
grype sbom:sbom/sbom-nodejs.json
```

### Dependency-Track

上传 SBOM 到 Dependency-Track 平台：
- 持续漏洞监控
- 风险评分
- 自动告警

## CI 集成位置

`.github/workflows/ci.yml` 最后三个步骤：

1. **Generate Python SBOM** - 生成 Python 依赖清单
2. **Generate Node.js SBOM** - 生成 Node.js 依赖清单
3. **Upload SBOM artifacts** - 上传到 GitHub Actions

## 最佳实践

### 开发阶段

- 每次添加新依赖后生成 SBOM
- 检查新依赖的已知漏洞
- 评估许可证兼容性

### 发布阶段

- 随每个版本发布 SBOM
- 归档 SBOM 用于审计追溯
- 通知客户依赖变更

### 生产运行

- 定期扫描 SBOM 检测新披露漏洞
- 设置自动告警
- 维护依赖更新计划

## SBOM 格式

CycloneDX JSON 格式包含：

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.4",
  "version": 1,
  "components": [
    {
      "type": "library",
      "name": "fastapi",
      "version": "0.104.1",
      "purl": "pkg:pypi/fastapi@0.104.1",
      "licenses": [...]
    }
  ]
}
```

### 关键字段

- **name**: 包名
- **version**: 版本号
- **purl**: Package URL（标准化包标识符）
- **licenses**: 许可证信息
- **hashes**: 包哈希值

## 合规要求

满足以下标准和要求：

- **NTIA Minimum Elements** - 美国商务部 SBOM 最小要素
- **Executive Order 14028** - 软件供应链安全行政令
- **ISO/IEC 5962** - SBOM 国际标准
- **CycloneDX 1.4+** - 行业标准 SBOM 格式

## 维护

### 定期更新

每月检查：
- 过时的依赖版本
- 新披露的安全漏洞
- 许可证变更

### 异常处理

发现高危漏洞时：
1. 评估影响范围
2. 检查是否有修复版本
3. 评估升级风险
4. 制定修复计划
5. 更新 SBOM

## 参考资料

- [CycloneDX Specification](https://cyclonedx.org/specification/overview/)
- [NTIA SBOM Minimum Elements](https://www.ntia.gov/report/2021/minimum-elements-software-bill-materials-sbom)
- [CISA SBOM Guidance](https://www.cisa.gov/sbom)
