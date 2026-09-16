# 前端与 API 性能基线

## 环境

- 日期：2026-08-31
- 前端：Next.js standalone build，16 个路由静态生成
- API：Docker Compose，localhost:8000

## 结果

命令：`python scripts/load_test.py`

| 场景 | 请求数 | 成功率 | P50 | P95 | P99 |
|---|---:|---:|---:|---:|---:|
| health-100 | 100 | 100% | 123.65ms | 154.17ms | 155.93ms |
| health-mixed-50 | 50 | 100% | 57.50ms | 71.80ms | 78.42ms |

前端构建验证：`npm run build`，TypeScript 检查通过，16/16 页面生成成功。

## 浏览器首屏采样

命令：`npx playwright test playwright/frontend-performance.spec.js --reporter=line`

采样页面：`/login`（本地 Chromium，单次冷启动采样）。

| 指标 | 结果 |
|---|---:|
| DOMContentLoaded | 226ms |
| Load event | 631ms |
| First Contentful Paint | 340ms |

最近一次自动化采样（2026-08-31）输出：`browser-performance {"domContentLoaded":399,"load":713,"fcp":424}`。该值受本地冷启动和构建缓存影响，仅用于趋势回归。

该采样用于回归趋势，不代表生产真实用户体验；正式发布仍需 Lighthouse/真实设备和多轮统计。

该报告是本地开发基线，不等同于生产容量认证；生产压测仍需 k6/Gatling 和真实负载模型。
