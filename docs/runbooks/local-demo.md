# 本地演示初始化与重置

本文档只适用于本地开发、答辩和学校申请演示。演示账号、数据库密码和默认密钥不得用于公网或生产环境。

## 环境要求

- Windows 10/11 和 PowerShell 7（Windows PowerShell 也可运行基础命令）
- Docker Desktop，使用 Linux containers
- 项目根目录下可创建本地 `.env` 文件

## 首次初始化

在项目根目录执行：

```powershell
Copy-Item .env.example .env
docker compose --profile frontend up -d --build
docker compose --profile frontend ps
```

Compose 会依次启动 PostgreSQL、执行 Alembic 迁移、写入演示账号、配置运行时数据库角色，然后启动 API、Worker 和 Web。首次构建需要下载镜像和依赖，耗时取决于网络。

服务地址：

| 服务 | 地址 | 正常状态 |
| --- | --- | --- |
| Web | `http://localhost:3000` | 能打开登录页 |
| API | `http://localhost:8000` | FastAPI 服务可访问 |
| 健康检查 | `http://localhost:8000/health` | HTTP 200 |
| 就绪检查 | `http://localhost:8000/ready` | HTTP 200 |
| OpenAPI | `http://localhost:8000/docs` | 能打开接口文档 |

## 演示账号

租户标识均为 `demo`，三个账号的本地演示密码均为 `ChangeMe123456!`：

| 账号 | 角色 | 用途 |
| --- | --- | --- |
| `admin@example.com` | 管理员 | 完整演示、审批和管理操作 |
| `member@example.com` | 普通成员 | 验证日常创建和运行权限 |
| `readonly@example.com` | 只读成员 | 验证只读访问限制 |

如果登录页未出现，先执行：

```powershell
docker compose --profile frontend ps
docker compose logs --tail=100 api web migrate seed provision
```

## 配置真实 AI 回答

默认 `MODEL_PROVIDER=mock`，用于离线演示。要使用 DeepSeek 等 OpenAI-compatible 服务，在本地 `.env` 中设置：

```dotenv
MODEL_PROVIDER=openai_compatible
MODEL_BASE_URL=https://api.deepseek.com/v1
MODEL_API_KEY=在此填写自己的密钥
MODEL_NAME=deepseek-chat
```

不要把真实 API Key 写入 `.env.example`、截图、提交记录或文档。修改后重建 API 和 Worker：

```powershell
docker compose up -d --force-recreate api worker
docker compose logs --tail=100 api worker
```

## 停止与再次启动

保留数据并停止：

```powershell
docker compose --profile frontend stop
```

保留数据并再次启动：

```powershell
docker compose --profile frontend start
```

## 重置全部演示数据

重置会永久删除本项目 Compose 管理的 PostgreSQL、Redis、Prometheus 和 Grafana 卷，并重新创建演示账号。不要在需要保留数据或连接生产环境时运行。

交互确认方式：

```powershell
.\scripts\reset_local_demo.ps1
```

自动化环境可显式确认，并复用已有镜像：

```powershell
.\scripts\reset_local_demo.ps1 -Force -SkipBuild
```

脚本只在项目根目录运行 `docker compose --profile frontend down --volumes --remove-orphans`，不会删除项目源文件。

## 最小验收

```powershell
$health = Invoke-WebRequest -UseBasicParsing http://localhost:8000/ready
$web = Invoke-WebRequest -UseBasicParsing http://localhost:3000/login
"API=$($health.StatusCode) Web=$($web.StatusCode)"
```

预期输出为 `API=200 Web=200`。随后用管理员账号登录，创建一个 Agent 或工作流并执行一次，即可完成本地演示主链路验收。
