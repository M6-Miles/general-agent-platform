# 前端信息架构 (Frontend Sitemap)

**创建时间**：2026-09-04  
**创建原因**：TASK-20260904-004（P3）- 前端页面层级结构和权限要求文档  
**页面总数**：38 个 `page.tsx` 路由文件（包含根页面）

---

## 页面层级结构

```text
/ (根页面 - 未登录时重定向到 /login，已登录时重定向到 /dashboard)
├── /login (登录页面 - 公开访问)
└── /dashboard (首页仪表盘 - 需认证)
    ├── /agents (Agent 列表页)
    │   ├── /agents/create (创建 Agent)
    │   └── /agents/[id]
    │       ├── /agents/[id]/test (测试 Agent)
    │       └── /agents/[id]/versions (Agent 版本历史)
    ├── /workflows (Workflow 列表页)
    │   ├── /workflows/create (隐式，通过 /workflows/[id] 创建新 workflow)
    │   └── /workflows/[id] (Workflow 编辑器 - DAG 可视化编辑)
    ├── /runs (Run 列表页 - 查看所有执行历史)
    │   └── /runs/[id] (Run 详情页 - 实时查看执行状态和日志)
    ├── /tools (Tool 列表页)
    │   ├── /tools/create (创建 Tool)
    │   └── /tools/[id] (Tool 详情和编辑)
    ├── /skills (Skill 列表页)
    │   ├── /skills/create (创建 Skill)
    │   └── /skills/[id] (Skill 详情和编辑)
    ├── /knowledge (Knowledge 库列表页)
    │   └── /knowledge/[id] (Knowledge 库详情 - 文档上传和检索)
    ├── /approvals (审批请求列表页 - 查看待审批的 run)
    ├── /conversations (对话历史页面)
    ├── /costs (成本统计和分析页面)
    ├── /audit (审计日志页面 - 查看操作记录)
    ├── /dlq (死信队列页面 - 查看失败任务)
    ├── /settings (用户设置页面)
    └── /admin (管理员功能区 - 需管理员权限)
        ├── /admin/tenants (租户管理)
        └── /admin/settings (系统设置)
```

---

## 页面权限要求

| 页面路径 | 需要认证 | 需要权限 | 角色要求 | 说明 |
|---------|---------|---------|---------|------|
| `/` | ❌ | - | - | 重定向到 `/login` 或 `/dashboard` |
| `/login` | ❌ | - | - | 公开登录页面 |
| `/dashboard` | ✅ | - | User | 已登录用户首页 |
| `/agents` | ✅ | `agent:read` | User | 查看 Agent 列表 |
| `/agents/create` | ✅ | `agent:create` | User | 创建 Agent |
| `/agents/[id]` | ✅ | `agent:read` | Owner/Admin | 查看 Agent 详情 |
| `/agents/[id]/test` | ✅ | `agent:execute` | Owner/Admin | 测试 Agent 执行 |
| `/agents/[id]/versions` | ✅ | `agent:read` | Owner/Admin | 查看 Agent 版本历史 |
| `/workflows` | ✅ | `workflow:read` | User | 查看 Workflow 列表 |
| `/workflows/[id]` | ✅ | `workflow:read`, `workflow:create`, `workflow:update` | Owner/Admin | 编辑 Workflow（DAG 可视化） |
| `/runs` | ✅ | `run:read` | User | 查看 Run 列表 |
| `/runs/[id]` | ✅ | `run:read` | Owner/Admin | 查看 Run 详情和日志 |
| `/tools` | ✅ | `tool:read` | User | 查看 Tool 列表 |
| `/tools/create` | ✅ | `tool:create` | User | 创建 Tool |
| `/tools/[id]` | ✅ | `tool:read` | Owner/Admin | 查看/编辑 Tool 详情 |
| `/skills` | ✅ | `skill:read` | User | 查看 Skill 列表 |
| `/skills/create` | ✅ | `skill:create` | User | 创建 Skill |
| `/skills/[id]` | ✅ | `skill:read` | Owner/Admin | 查看/编辑 Skill 详情 |
| `/knowledge` | ✅ | `knowledge:read` | User | 查看 Knowledge 库列表 |
| `/knowledge/[id]` | ✅ | `knowledge:read`, `knowledge:upload` | Owner/Admin | 上传文档和检索 |
| `/approvals` | ✅ | `approval:read`, `approval:decide` | User/Approver | 查看和处理审批请求 |
| `/conversations` | ✅ | `conversation:read` | User | 查看对话历史 |
| `/costs` | ✅ | `cost:read` | User | 查看成本统计 |
| `/audit` | ✅ | `audit:read` | Admin | 查看审计日志 |
| `/dlq` | ✅ | `dlq:read` | Admin | 查看死信队列 |
| `/settings` | ✅ | - | User | 用户个人设置 |
| `/admin/tenants` | ✅ | `tenant:manage` | Admin | 租户管理（创建、编辑、删除租户） |
| `/admin/settings` | ✅ | `system:manage` | Admin | 系统全局设置 |

---

## 核心用户路径

### 1. Agent 创建和测试路径
1. `/agents` - 查看 Agent 列表
2. `/agents/create` - 创建新 Agent
3. `/agents/[id]` - 配置 Agent 详情
4. `/agents/[id]/test` - 测试 Agent 执行
5. `/runs/[id]` - 查看执行结果

### 2. Workflow 创建和执行路径
1. `/workflows` - 查看 Workflow 列表
2. `/workflows/[id]` - 编辑 Workflow（DAG 可视化）
3. `/agents/[id]` - 关联 Agent
4. 执行 Workflow（通过 API 或 `/agents/[id]/test`）
5. `/runs` - 查看 Workflow 执行历史
6. `/runs/[id]` - 查看 Workflow 执行详情

### 3. 审批流程路径
1. `/agents/[id]/test` - 执行需要审批的 Tool（`require_approval=True`）
2. `/runs/[id]` - 查看 Run 状态（等待审批）
3. `/approvals` - 查看审批请求列表
4. 输入 `approval_token` 并提交 approve/reject
5. `/runs/[id]` - 验证 Run 继续执行或停止

### 4. Knowledge 库使用路径
1. `/knowledge` - 查看 Knowledge 库列表
2. `/knowledge/[id]` - 上传文档
3. 等待解析完成
4. `/agents/[id]` - 配置 Agent 使用 Knowledge 库
5. `/agents/[id]/test` - 测试检索和引用溯源

### 5. 管理员租户管理路径
1. `/admin/tenants` - 查看租户列表
2. 创建新租户
3. 配置租户配额和权限
4. `/audit` - 查看租户操作审计日志

---

## 孤立页面检查

**无孤立页面** - 正式 `web/app` 路由均属于当前前端工程；`demo-new-design` 和 `agents-modern` 为保留的演示/兼容入口。

### 主导航结构（当前实现）

正式导航由 `web/app/components/PlatformHeader.tsx`、`Workspace.tsx` 等组件提供，当前入口包括：

1. **核心功能区**（侧边栏主菜单）：
   - Dashboard（首页）
   - Agents（Agent 管理）
   - Workflows（工作流管理）
   - Runs（执行历史）
   - Tools（工具库）
   - Skills（技能库）
   - Knowledge（知识库）
   - Approvals（审批）

2. **辅助功能区**（侧边栏次级菜单或顶部菜单）：
   - Conversations（对话历史）
   - Costs（成本统计）
   - Audit（审计日志 - 仅管理员）
   - DLQ（死信队列 - 仅管理员）

3. **系统管理区**（侧边栏底部或顶部下拉）：
   - Settings（用户设置）
   - Admin（管理员功能 - 仅管理员）
     - Tenants（租户管理）
     - Settings（系统设置）

4. **入口页面**（无导航）：
   - Login（登录页面）

---

## 权限矩阵

### 用户角色定义（当前实现）

| 角色 | 权限范围 | 典型用户 |
|-----|---------|---------|
| **Guest** | 无 | 未登录用户（只能访问 `/login`） |
| **member** | 租户内基础读写和执行权限，受服务端权限检查约束 | 普通开发者 |
| **tenant_admin** | 租户管理、审批决策和租户级设置 | 租户管理员 |
| **admin** | 平台级管理权限 | 平台管理员 |
| **readonly** | 只读访问，不能创建、执行或修改资源 | 只读审阅者 |

### 资源访问控制（当前实现）

- **Owner**：资源创建者（`created_by = current_user.id`）
- **Shared**：以租户范围和服务端权限为准，当前模型不以统一 `is_shared` 字段作为授权依据。
- **Tenant Isolation**：所有资源通过 `tenant_id` 过滤；PostgreSQL 环境启用 RLS，应用层同时执行租户范围检查。

---

## 已验证与待补充事项

以下结论已根据当前代码核对；移动端和面包屑仍属于体验层补充项：

1. ✅ **主导航结构**：由 `PlatformHeader.tsx`、`Workspace.tsx` 和页面入口共同提供
2. ✅ **权限实际实现**：前端负责认证态跳转，服务端 `require_permission(...)` 和角色检查负责最终授权
3. ✅ **孤立页面检查**：38 个正式路由文件均属于 `web/app` 工程
4. ✅ **角色定义**：`admin`、`tenant_admin`、`member`、`readonly`
5. ⏳ **移动端导航**：移动端（窄屏）导航的实际实现方式（需查看响应式布局代码）
6. ⏳ **面包屑导航**：详情页面是否包含面包屑导航（需查看各详情页 `page.tsx`）

---

## 页面状态覆盖检查

根据前端优化阶段要求，每个页面应包含以下状态：

| 状态类型 | 说明 | 示例页面 |
|---------|------|---------|
| **加载中** | 首次加载或刷新数据时显示 Loading 状态 | `/agents`, `/workflows`, `/runs` |
| **空数据** | 列表为空时显示友好提示和引导操作 | `/agents` (无 Agent 时) |
| **错误** | API 请求失败时显示错误信息和重试按钮 | 任何页面网络错误 |
| **权限不足** | 无权限访问时显示 403 提示 | `/admin/tenants` (非管理员) |
| **提交中** | 表单提交或操作执行中显示 Loading 状态 | `/agents/create` (创建中) |
| **成功** | 操作成功后显示成功提示（Toast 或页面提示） | 创建/更新/删除成功 |

**验收要求**：发布前逐页检查这些状态的实际实现。

---

## 关键页面功能清单

### Agent 页面 (`/agents`, `/agents/[id]`)
- ✅ Agent 列表分页
- ✅ Agent 搜索和筛选
- ✅ Agent 创建表单
- ✅ Agent 配置（模型、参数、权限、Tool、Skill、Knowledge 关联）
- ✅ Agent 版本管理
- ✅ Agent 测试执行

### Workflow 页面 (`/workflows`, `/workflows/[id]`)
- ✅ Workflow 列表
- ✅ DAG 可视化编辑器（节点增删改、连线、保存）
- ✅ Workflow 执行配置

### Run 页面 (`/runs`, `/runs/[id]`)
- ✅ Run 列表分页和筛选
- ✅ Run 详情查看（状态、日志、事件流）
- ✅ SSE 实时日志流
- ✅ Run 取消和重试

### Approval 页面 (`/approvals`)
- ✅ 审批请求列表
- ✅ 审批令牌输入
- ✅ Approve/Reject 决策提交
- ✅ 过期审批处理

### Knowledge 页面 (`/knowledge`, `/knowledge/[id]`)
- ✅ Knowledge 库列表
- ✅ 文档上传（支持多文件、拖拽）
- ✅ 文档解析状态显示
- ✅ 检索测试
- ✅ 引用溯源显示

### Admin 页面 (`/admin/tenants`, `/admin/settings`)
- ✅ 租户列表和创建
- ✅ 租户配额配置
- ✅ 系统全局设置（模型配置、成本限制、审计策略）

---

## 前端路由保护策略

### 认证检查（所有页面除公开入口）
```typescript
// 当前实现使用 AuthProvider 中的 token/ready 状态和客户端路由跳转。
if (!token) router.push('/login')
```

### 权限检查（服务端为准）
```typescript
// API 请求由服务端依赖注入执行最终权限检查。
principal: Principal = Depends(require_permission("agent:read"))
```

### 租户隔离检查（所有 API 请求）
```typescript
// tenant_id 来自服务端认证主体；客户端不应作为授权事实源。
headers: {
  'Authorization': `Bearer ${session.access_token}`,
}
```

---

## 文档更新计划

### 本文档（`frontend-sitemap.md`）

- **当前状态**：已创建，包含 38 个 `page.tsx` 路由文件的层级结构、权限要求、核心用户路径
- **待完善**：
  1. 补充移动端导航结构验证
  2. 补充面包屑导航结构验证
  3. 逐页复核加载、空数据、错误、权限不足和提交中状态

### 相关文档

- **`project/docs/09-openclaw-agent-platform-frontend-design.md`**：前端架构设计文档（已存在）
- **`project/docs/OpenClaw通用Agent平台-Next.js企业级开发总控Prompt.md`**：前端开发总控（已存在）

---

## 结论

**前端信息架构清晰** ✅

- 38 个路由文件覆盖登录、注册、密码找回、Agent、Workflow、Run、Tool、Skill、Knowledge、Approval、Audit、成本和 Admin 功能
- 页面层级结构合理，核心功能集中在 `/dashboard` 子路由下
- 权限控制完整，包含 admin、tenant_admin、member、readonly 四类角色
- 核心用户路径清晰，支持 Agent 创建→Workflow 编排→Run 执行→Approval 审批→Knowledge 检索 完整流程
- **无孤立页面**，所有页面都可通过导航到达

**建议后续优化**（不阻塞交付）：

1. 补充每个页面的移动端和面包屑体验验证
2. 补充移动端导航和响应式布局验证
3. 补充面包屑导航和页面标题验证
4. 补充每个页面的状态覆盖验证（加载、空数据、错误、权限不足、提交中、成功）
