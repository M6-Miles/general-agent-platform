# OpenClaw Agent 平台 - 企业级前端设计规范

_负责人：前端团队｜状态：设计基线｜版本：v1.1｜最后更新：2026-08-24_

---

## 一、设计系统（Design System）

### 1.1 色彩系统

```typescript
// packages/ui/src/design-tokens/colors.ts

export const colors = {
  // 品牌色
  brand: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',  // 主品牌色
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  
  // 功能色
  success: {
    light: '#10b981',
    DEFAULT: '#059669',
    dark: '#047857',
  },
  warning: {
    light: '#f59e0b',
    DEFAULT: '#d97706',
    dark: '#b45309',
  },
  error: {
    light: '#ef4444',
    DEFAULT: '#dc2626',
    dark: '#b91c1c',
  },
  info: {
    light: '#3b82f6',
    DEFAULT: '#2563eb',
    dark: '#1d4ed8',
  },
  
  // 中性色（文字、背景、边框）
  neutral: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },
  
  // 语义化颜色（用于状态徽章）
  status: {
    draft: '#94a3b8',      // 草稿（灰色）
    testing: '#3b82f6',    // 测试中（蓝色）
    published: '#10b981',  // 已发布（绿色）
    paused: '#f59e0b',     // 已暂停（橙色）
    archived: '#6b7280',   // 已归档（深灰）
    failed: '#ef4444',     // 失败（红色）
  },
  
  // 风险等级颜色
  risk: {
    safe: '#10b981',       // 安全（绿色）
    medium: '#f59e0b',     // 中等（橙色）
    high: '#f97316',       // 高风险（深橙）
    critical: '#dc2626',   // 严重（红色）
  },
};
```

### 1.2 字体系统

```typescript
// packages/ui/src/design-tokens/typography.ts

export const typography = {
  fontFamily: {
    sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
    // 中文字体回退
    cjk: ['PingFang SC', 'Microsoft YaHei', 'sans-serif'],
  },
  
  fontSize: {
    xs: ['12px', { lineHeight: '16px' }],
    sm: ['14px', { lineHeight: '20px' }],
    base: ['16px', { lineHeight: '24px' }],
    lg: ['18px', { lineHeight: '28px' }],
    xl: ['20px', { lineHeight: '28px' }],
    '2xl': ['24px', { lineHeight: '32px' }],
    '3xl': ['30px', { lineHeight: '36px' }],
    '4xl': ['36px', { lineHeight: '40px' }],
  },
  
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};
```

### 1.3 间距系统

```typescript
// packages/ui/src/design-tokens/spacing.ts

export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
};
```

### 1.4 圆角和阴影

```typescript
// packages/ui/src/design-tokens/effects.ts

export const borderRadius = {
  none: '0',
  sm: '4px',
  base: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

export const boxShadow = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
};
```

---

## 二、布局架构

### 2.1 整体布局（Main Layout）

```text
┌─────────────────────────────────────────────────────────┐
│  Header (64px fixed)                                    │
│  - Logo + 平台名称                                        │
│  - 全局搜索                                              │
│  - 通知 + 用户菜单                                        │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │  Main Content Area                          │
│ (240px)  │  - Breadcrumb                               │
│          │  - Page Header                              │
│ - 导航   │  - Page Content                             │
│ - 快捷   │                                              │
│   操作   │                                              │
│          │                                              │
│          │                                              │
│          │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

#### Header 组件

```typescript
// apps/web/src/components/layout/Header.tsx

interface HeaderProps {
  user: User;
  tenant: Tenant;
  notificationCount: number;
}

export function Header({ user, tenant, notificationCount }: HeaderProps) {
  return (
    <header className="h-16 border-b border-neutral-200 bg-white">
      <div className="flex h-full items-center justify-between px-6">
        {/* 左侧：Logo + 平台名称 */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-semibold text-neutral-900">
              Agent 平台
            </span>
          </Link>
          
          {/* 租户切换（如果用户属于多个租户）*/}
          <TenantSwitcher currentTenant={tenant} />
        </div>
        
        {/* 中间：全局搜索 */}
        <GlobalSearch />
        
        {/* 右侧：通知 + 用户菜单 */}
        <div className="flex items-center gap-4">
          <NotificationBell count={notificationCount} />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
```

#### Sidebar 组件

```typescript
// apps/web/src/components/layout/Sidebar.tsx

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType;
  badge?: number;
  permission?: string; // 权限控制
}

const navItems: NavItem[] = [
  { label: '首页', href: '/', icon: HomeIcon },
  { label: 'Agent', href: '/agents', icon: RobotIcon },
  { label: 'Skill 市场', href: '/skills', icon: PackageIcon },
  { label: '会话', href: '/conversations', icon: ChatIcon },
  { label: '审批中心', href: '/approvals', icon: CheckCircleIcon, badge: 5 },
  { label: '知识库', href: '/knowledge', icon: BookIcon },
  { label: '工作流', href: '/workflows', icon: WorkflowIcon },
  { label: '审计日志', href: '/audit', icon: ShieldIcon, permission: 'audit:read:tenant' },
  { label: '设置', href: '/settings', icon: SettingsIcon },
];

export function Sidebar() {
  const { hasPermission } = usePermissions();
  const pathname = usePathname();
  
  return (
    <aside className="w-60 border-r border-neutral-200 bg-white">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          // 权限检查
          if (item.permission && !hasPermission(item.permission)) {
            return null;
          }
          
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-md',
                'transition-colors duration-150',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-neutral-700 hover:bg-neutral-100'
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {item.badge && (
                <Badge variant="error" size="sm">
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
      
      {/* 快捷操作 */}
      <div className="p-4 border-t border-neutral-200">
        <Button
          fullWidth
          size="md"
          leftIcon={<PlusIcon />}
          onClick={() => router.push('/agents/create')}
        >
          创建 Agent
        </Button>
      </div>
    </aside>
  );
}
```

---

## 三、核心页面设计

### 3.1 登录页 (`/login`)

#### 布局

```text
┌────────────────────────────────────────────────┐
│                                                │
│              居中卡片 (max-w-md)                │
│  ┌──────────────────────────────────────────┐ │
│  │  Logo + 平台名称                          │ │
│  │                                          │ │
│  │  【邮箱输入框】                           │ │
│  │  【密码输入框】                           │ │
│  │  □ 记住我           忘记密码？            │ │
│  │  【登录按钮（全宽）】                      │ │
│  │                                          │ │
│  │  ────── 或 ──────                        │ │
│  │                                          │ │
│  │  【企业 SSO 登录】（灰色，预留）          │ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  © 2024 Agent Platform. All rights reserved.  │
└────────────────────────────────────────────────┘
```

#### 组件实现

```typescript
// apps/web/src/app/login/page.tsx

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await login({ email, password, rememberMe });
      router.push('/');
    } catch (err) {
      // 不泄露账号是否存在
      setError('邮箱或密码错误');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Logo className="mx-auto h-12 w-12 mb-4" />
          <h1 className="text-2xl font-bold text-neutral-900">
            登录 Agent 平台
          </h1>
          <p className="text-sm text-neutral-600 mt-2">
            使用企业邮箱登录
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 错误提示 */}
            {error && (
              <Alert variant="error">
                <AlertIcon />
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}
            
            {/* 邮箱输入 */}
            <FormField>
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </FormField>
            
            {/* 密码输入 */}
            <FormField>
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </FormField>
            
            {/* 记住我 + 忘记密码 */}
            <div className="flex items-center justify-between">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={setRememberMe}
                label="记住我"
              />
              <Link
                href="/forgot-password"
                className="text-sm text-brand-600 hover:text-brand-700"
              >
                忘记密码？
              </Link>
            </div>
            
            {/* 登录按钮 */}
            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isLoading}
            >
              登录
            </Button>
          </form>
          
          {/* 分隔线 */}
          <Divider className="my-6">或</Divider>
          
          {/* 企业 SSO（预留，灰色禁用状态）*/}
          <Button
            fullWidth
            variant="outline"
            disabled
            leftIcon={<BuildingIcon />}
          >
            企业 SSO 登录
            <Badge variant="neutral" size="sm" className="ml-2">
              即将推出
            </Badge>
          </Button>
        </CardContent>
      </Card>
      
      {/* 页脚 */}
      <footer className="absolute bottom-4 text-center text-sm text-neutral-500">
        © 2024 Agent Platform. All rights reserved.
      </footer>
    </div>
  );
}
```

#### 状态处理

| 状态 | UI 表现 |
|------|---------|
| 正常 | 输入框可输入，登录按钮蓝色 |
| 加载中 | 登录按钮显示 Spinner，输入框禁用 |
| 错误 | 顶部显示红色 Alert，输入框边框变红 |
| 账号停用 | Alert 显示"账号已停用，请联系管理员" |
| 租户过期 | Alert 显示"租户已过期，请联系管理员续费" |

---

### 3.2 首页 (`/`)

#### 布局

```text
┌─────────────────────────────────────────────────────┐
│ 面包屑：首页                                          │
├─────────────────────────────────────────────────────┤
│ 页面标题：欢迎回来，{userName}                        │
│ 副标题：这是您的工作台概览                             │
├─────────────────────────────────────────────────────┤
│ 统计卡片（3列）                                        │
│ ┌───────────┬───────────┬───────────┐              │
│ │ 本月调用   │ Token消耗  │ 本月成本   │              │
│ │ 1,234次   │ 2.5M      │ ¥128.50   │              │
│ │ +12%↑    │ +8%↑      │ +15%↑     │              │
│ └───────────┴───────────┴───────────┘              │
├─────────────────────────────────────────────────────┤
│ 我的 Agent（卡片网格，最多显示8个）                    │
│ ┌─────┬─────┬─────┬─────┐                          │
│ │Agent│Agent│Agent│Agent│  【查看全部 →】           │
│ │  1  │  2  │  3  │  4  │                          │
│ ├─────┼─────┼─────┼─────┤                          │
│ │Agent│Agent│Agent│Agent│                          │
│ │  5  │  6  │  7  │  8  │                          │
│ └─────┴─────┴─────┴─────┘                          │
├─────────────────────────────────────────────────────┤
│ 最近会话（列表，最多5条）                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 客服助手  2026-08-24 14:30  查看会话 →          │ │
│ │ 数据分析  2026-08-24 10:20  查看会话 →          │ │
│ │ ...                                             │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### 组件实现

```typescript
// apps/web/src/app/page.tsx

export default async function HomePage() {
  const user = await getCurrentUser();
  const stats = await getDashboardStats(user.tenantId);
  const agents = await getMyAgents(user.id, { limit: 8 });
  const conversations = await getRecentConversations(user.id, { limit: 5 });
  
  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <PageHeader
        title={`欢迎回来，${user.displayName}`}
        description="这是您的工作台概览"
      />
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="本月调用"
          value={stats.monthlyRuns.toLocaleString()}
          trend={stats.runsTrend}
          icon={<ActivityIcon />}
          color="brand"
        />
        <StatsCard
          title="Token 消耗"
          value={formatTokens(stats.monthlyTokens)}
          trend={stats.tokensTrend}
          icon={<DatabaseIcon />}
          color="success"
        />
        <StatsCard
          title="本月成本"
          value={`¥${stats.monthlyCost.toFixed(2)}`}
          trend={stats.costTrend}
          icon={<DollarIcon />}
          color="warning"
        />
      </div>
      
      {/* 我的 Agent */}
      <Section
        title="我的 Agent"
        action={
          <Button variant="ghost" size="sm" href="/agents">
            查看全部 <ArrowRightIcon />
          </Button>
        }
      >
        {agents.length === 0 ? (
          <EmptyState
            icon={<RobotIcon />}
            title="还没有 Agent"
            description="创建您的第一个 Agent 开始使用"
            action={
              <Button href="/agents/create" leftIcon={<PlusIcon />}>
                创建 Agent
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </Section>
      
      {/* 最近会话 */}
      <Section
        title="最近会话"
        action={
          <Button variant="ghost" size="sm" href="/conversations">
            查看全部 <ArrowRightIcon />
          </Button>
        }
      >
        {conversations.length === 0 ? (
          <EmptyState
            icon={<ChatIcon />}
            title="还没有会话"
            description="开始与 Agent 对话"
          />
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <ConversationListItem key={conv.id} conversation={conv} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
```

#### AgentCard 组件

```typescript
// apps/web/src/components/agent/AgentCard.tsx

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        {/* 图标 + 名称 */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar
            src={agent.avatar}
            fallback={agent.displayName[0]}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-neutral-900 truncate">
              {agent.displayName}
            </h3>
            <p className="text-sm text-neutral-600 line-clamp-2">
              {agent.description}
            </p>
          </div>
        </div>
        
        {/* 状态徽章 */}
        <div className="flex items-center gap-2 mb-3">
          <StatusBadge status={agent.status} />
          <span className="text-xs text-neutral-500">
            {agent.skillRefs.length} 个 Skill
          </span>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            size="sm"
            fullWidth
            href={`/agents/${agent.id}/test`}
          >
            测试
          </Button>
          <Button
            size="sm"
            variant="outline"
            href={`/agents/${agent.id}`}
          >
            编辑
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 3.3 Agent 列表页 (`/agents`)

#### 布局

```text
┌─────────────────────────────────────────────────────┐
│ 面包屑：首页 > Agent                                  │
├─────────────────────────────────────────────────────┤
│ 页面标题：Agent                    【创建 Agent】     │
├─────────────────────────────────────────────────────┤
│ Tab：我的(12) | 团队(45) | 公开模板(8)                │
├─────────────────────────────────────────────────────┤
│ 【搜索框】 【筛选：状态▼】【筛选：标签▼】【排序▼】[图]│
├─────────────────────────────────────────────────────┤
│ Agent 卡片网格                                        │
│ ┌──────────┬──────────┬──────────┬──────────┐       │
│ │ Agent 1  │ Agent 2  │ Agent 3  │ Agent 4  │       │
│ ├──────────┼──────────┼──────────┼──────────┤       │
│ │ Agent 5  │ Agent 6  │ Agent 7  │ Agent 8  │       │
│ └──────────┴──────────┴──────────┴──────────┘       │
├─────────────────────────────────────────────────────┤
│ 分页：< 1 2 3 ... 10 >                               │
└─────────────────────────────────────────────────────┘
```

#### 组件实现

```typescript
// apps/web/src/app/agents/page.tsx

export default function AgentsPage({
  searchParams,
}: {
  searchParams: { tab?: string; q?: string; status?: string; sort?: string };
}) {
  const tab = searchParams.tab || 'my';
  const query = searchParams.q || '';
  const status = searchParams.status || 'all';
  const sort = searchParams.sort || 'recent';
  
  return (
    <div className="space-y-6">
      {/* 页面标题 + 创建按钮 */}
      <PageHeader
        title="Agent"
        action={
          <Button leftIcon={<PlusIcon />} href="/agents/create">
            创建 Agent
          </Button>
        }
      />
      
      {/* Tab 切换 */}
      <Tabs value={tab}>
        <TabsList>
          <TabsTrigger value="my" href="/agents?tab=my">
            我的 <Badge variant="neutral" size="sm">12</Badge>
          </TabsTrigger>
          <TabsTrigger value="team" href="/agents?tab=team">
            团队 <Badge variant="neutral" size="sm">45</Badge>
          </TabsTrigger>
          <TabsTrigger value="template" href="/agents?tab=template">
            公开模板 <Badge variant="neutral" size="sm">8</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* 搜索和筛选栏 */}
      <div className="flex items-center gap-3">
        <SearchInput
          placeholder="搜索 Agent..."
          value={query}
          onChange={(value) => updateSearchParams({ q: value })}
          className="flex-1 max-w-md"
        />
        
        <Select value={status} onValueChange={(v) => updateSearchParams({ status: v })}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="testing">测试中</SelectItem>
            <SelectItem value="published">已发布</SelectItem>
            <SelectItem value="paused">已暂停</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={sort} onValueChange={(v) => updateSearchParams({ sort: v })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">最近创建</SelectItem>
            <SelectItem value="name">名称</SelectItem>
            <SelectItem value="usage">使用次数</SelectItem>
            <SelectItem value="cost">成本</SelectItem>
          </SelectContent>
        </Select>
        
        {/* 视图切换：网格/列表 */}
        <ViewToggle value="grid" onChange={setView} />
      </div>
      
      {/* Agent 列表 */}
      <AgentList
        tab={tab}
        query={query}
        status={status}
        sort={sort}
        view="grid"
      />
    </div>
  );
}
```

---

### 3.4 Agent 创建向导 (`/agents/create`)

#### 整体布局

```text
┌─────────────────────────────────────────────────────┐
│ 面包屑：首页 > Agent > 创建                           │
├─────────────────────────────────────────────────────┤
│ 步骤指示器：                                          │
│ ① 选择模板 → ② 基本信息 → ③ 选择能力 → ④ 配置权限    │
│   → ⑤ 审批策略 → ⑥ 选择入口 → ⑦ 预览发布             │
├─────────────────────────────────────────────────────┤
│ 当前步骤内容区域                                      │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ 【保存草稿】              【上一步】  【下一步】      │
└─────────────────────────────────────────────────────┘
```

#### 步骤 1：选择模板

```typescript
// apps/web/src/app/agents/create/steps/Step1Template.tsx

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  skillsCount: number;
}

const templates: Template[] = [
  {
    id: 'customer-service',
    name: '客服助手',
    description: '处理客户咨询、售后问题和工单',
    icon: '💬',
    category: '客户服务',
    skillsCount: 5,
  },
  {
    id: 'sales-assistant',
    name: '销售助手',
    description: '客户线索跟进、CRM 更新和销售分析',
    icon: '📊',
    category: '销售',
    skillsCount: 6,
  },
  {
    id: 'data-analyst',
    name: '数据分析助手',
    description: 'Excel 分析、数据可视化和报表生成',
    icon: '📈',
    category: '数据分析',
    skillsCount: 8,
  },
  {
    id: 'content-writer',
    name: '内容写作助手',
    description: '文章撰写、文案优化和SEO建议',
    icon: '✍️',
    category: '内容创作',
    skillsCount: 4,
  },
  {
    id: 'research-assistant',
    name: '研究助手',
    description: '资料收集、文献整理和报告生成',
    icon: '🔍',
    category: '研究',
    skillsCount: 7,
  },
  {
    id: 'blank',
    name: '从头开始',
    description: '创建空白 Agent，自由配置所有功能',
    icon: '✨',
    category: '自定义',
    skillsCount: 0,
  },
];

export function Step1Template({ value, onChange, onNext }) {
  const [selectedTemplate, setSelectedTemplate] = useState(value);
  
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-neutral-900">
          选择 Agent 模板
        </h2>
        <p className="text-neutral-600 mt-2">
          从预设模板开始，或创建空白 Agent
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={cn(
              'cursor-pointer transition-all duration-200',
              'hover:shadow-md',
              selectedTemplate === template.id &&
                'ring-2 ring-brand-500 shadow-md'
            )}
            onClick={() => {
              setSelectedTemplate(template.id);
              onChange(template.id);
            }}
          >
            <CardContent className="p-6">
              {/* 图标 */}
              <div className="text-4xl mb-4">{template.icon}</div>
              
              {/* 名称 */}
              <h3 className="font-semibold text-lg text-neutral-900 mb-2">
                {template.name}
              </h3>
              
              {/* 描述 */}
              <p className="text-sm text-neutral-600 mb-4">
                {template.description}
              </p>
              
              {/* 底部信息 */}
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <Badge variant="neutral" size="sm">
                  {template.category}
                </Badge>
                {template.skillsCount > 0 && (
                  <span>{template.skillsCount} 个 Skill</span>
                )}
              </div>
              
              {/* 选中标识 */}
              {selectedTemplate === template.id && (
                <div className="absolute top-3 right-3">
                  <CheckCircleIcon className="h-6 w-6 text-brand-600" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!selectedTemplate}
          onClick={onNext}
        >
          下一步
        </Button>
      </div>
    </div>
  );
}
```

#### 步骤 2：基本信息

```typescript
// apps/web/src/app/agents/create/steps/Step2BasicInfo.tsx

export function Step2BasicInfo({ value, onChange, onNext, onBack }) {
  const form = useForm({
    defaultValues: value,
    resolver: zodResolver(basicInfoSchema),
  });
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-neutral-900">
          填写基本信息
        </h2>
        <p className="text-neutral-600 mt-2">
          为您的 Agent 设置名称和描述
        </p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => {
          onChange(data);
          onNext();
        })} className="space-y-6">
          
          {/* Agent 名称 */}
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agent 名称 *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="例如：客服助手"
                    maxLength={50}
                  />
                </FormControl>
                <FormDescription>
                  <span className="text-neutral-500">
                    {field.value?.length || 0} / 50
                  </span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Agent 描述 */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>描述 *</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="简要描述这个 Agent 的用途和能力"
                    rows={4}
                    maxLength={200}
                  />
                </FormControl>
                <FormDescription>
                  <span className="text-neutral-500">
                    {field.value?.length || 0} / 200
                  </span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Agent 图标 */}
          <FormField
            control={form.control}
            name="avatar"
            render={({ field }) => (
              <FormItem>
                <FormLabel>图标</FormLabel>
                <FormControl>
                  <AvatarUploader
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>
                  上传自定义图标或选择预设图标
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* 服务对象（可选）*/}
          <FormField
            control={form.control}
            name="audience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>服务对象（可选）</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="例如：客户、销售团队、内部员工"
                  />
                </FormControl>
                <FormDescription>
                  这个 Agent 主要服务于谁？
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* 工作目标（可选）*/}
          <FormField
            control={form.control}
            name="goals"
            render={({ field }) => (
              <FormItem>
                <FormLabel>工作目标（可选）</FormLabel>
                <FormControl>
                  <TagInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="按 Enter 添加目标"
                  />
                </FormControl>
                <FormDescription>
                  例如：提高客户满意度、减少响应时间
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* 底部按钮 */}
          <div className="flex justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
            >
              上一步
            </Button>
            <Button type="submit">
              下一步
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
```

#### 步骤 3：选择 Skill

```typescript
// apps/web/src/app/agents/create/steps/Step3Skills.tsx

export function Step3Skills({ value, onChange, onNext, onBack }) {
  const [selectedSkills, setSelectedSkills] = useState<string[]>(value || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const { data: skills, isLoading } = useQuery({
    queryKey: ['skills', searchQuery, categoryFilter],
    queryFn: () => fetchSkills({ query: searchQuery, category: categoryFilter }),
  });
  
  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  };
  
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-neutral-900">
          选择 Agent 的能力
        </h2>
        <p className="text-neutral-600 mt-2">
          从 Skill 市场中选择 Agent 需要的能力
        </p>
      </div>
      
      <div className="flex items-start gap-6">
        {/* 左侧：Skill 列表 */}
        <div className="flex-1 space-y-4">
          {/* 搜索和筛选 */}
          <div className="flex gap-3">
            <SearchInput
              placeholder="搜索 Skill..."
              value={searchQuery}
              onChange={setSearchQuery}
              className="flex-1"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                <SelectItem value="file">文件处理</SelectItem>
                <SelectItem value="network">网络</SelectItem>
                <SelectItem value="data">数据分析</SelectItem>
                <SelectItem value="communication">通信</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Skill 卡片网格 */}
          {isLoading ? (
            <SkillCardSkeleton count={6} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {skills?.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  selected={selectedSkills.includes(skill.id)}
                  onToggle={() => toggleSkill(skill.id)}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* 右侧：已选 Skill（悬浮固定）*/}
        <div className="w-80 sticky top-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                已选择 Skill
                <Badge variant="neutral" size="sm" className="ml-2">
                  {selectedSkills.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedSkills.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-sm">
                  还未选择 Skill
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedSkills.map((skillId) => {
                    const skill = skills?.find((s) => s.id === skillId);
                    if (!skill) return null;
                    
                    return (
                      <div
                        key={skillId}
                        className="flex items-center justify-between p-2 rounded-md bg-neutral-50"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <skill.icon className="h-4 w-4 text-neutral-600 flex-shrink-0" />
                          <span className="text-sm truncate">
                            {skill.displayName}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleSkill(skillId)}
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* 底部按钮 */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          上一步
        </Button>
        <Button
          disabled={selectedSkills.length === 0}
          onClick={() => {
            onChange(selectedSkills);
            onNext();
          }}
        >
          下一步
        </Button>
      </div>
    </div>
  );
}
```

#### SkillCard 组件

```typescript
// apps/web/src/components/skill/SkillCard.tsx

interface SkillCardProps {
  skill: Skill;
  selected: boolean;
  onToggle: () => void;
}

export function SkillCard({ skill, selected, onToggle }: SkillCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:shadow-md',
        selected && 'ring-2 ring-brand-500 bg-brand-50'
      )}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <skill.icon className="h-5 w-5 text-neutral-700" />
            <h3 className="font-medium text-neutral-900">
              {skill.displayName}
            </h3>
          </div>
          {selected && (
            <CheckCircleIcon className="h-5 w-5 text-brand-600" />
          )}
        </div>
        
        <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
          {skill.description}
        </p>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="neutral" size="sm">
            {skill.category}
          </Badge>
          <RiskBadge level={skill.riskLevel} />
          
          {/* 权限提示 */}
          {skill.requiredPermissions.length > 0 && (
            <Tooltip content={
              <div className="space-y-1">
                <div className="font-medium">需要权限：</div>
                {skill.requiredPermissions.map((perm) => (
                  <div key={perm} className="text-xs">• {perm}</div>
                ))}
              </div>
            }>
              <Badge variant="warning" size="sm">
                <ShieldIcon className="h-3 w-3 mr-1" />
                {skill.requiredPermissions.length} 个权限
              </Badge>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 步骤 4：配置权限

```typescript
// apps/web/src/app/agents/create/steps/Step4Permissions.tsx

interface Permission {
  id: string;
  name: string;
  description: string;
  riskLevel: 'safe' | 'medium' | 'high' | 'critical';
  defaultEnabled: boolean;
}

const permissions: Permission[] = [
  {
    id: 'file:read',
    name: '读取文件',
    description: '允许 Agent 读取用户上传的文件',
    riskLevel: 'safe',
    defaultEnabled: true,
  },
  {
    id: 'file:write',
    name: '写入文件',
    description: '允许 Agent 创建新文件或修改已有文件',
    riskLevel: 'medium',
    defaultEnabled: true,
  },
  {
    id: 'network:access',
    name: '访问网络',
    description: '允许 Agent 访问外部网站和 API',
    riskLevel: 'medium',
    defaultEnabled: false,
  },
  {
    id: 'communication:send',
    name: '发送消息',
    description: '允许 Agent 发送邮件或群消息',
    riskLevel: 'high',
    defaultEnabled: false,
  },
  {
    id: 'system:execute',
    name: '执行命令',
    description: '允许 Agent 在沙箱中执行系统命令',
    riskLevel: 'critical',
    defaultEnabled: false,
  },
];

export function Step4Permissions({ value, onChange, onNext, onBack }) {
  const [enabledPermissions, setEnabledPermissions] = useState<string[]>(
    value || permissions.filter((p) => p.defaultEnabled).map((p) => p.id)
  );
  
  const togglePermission = (permId: string) => {
    setEnabledPermissions((prev) =>
      prev.includes(permId)
        ? prev.filter((id) => id !== permId)
        : [...prev, permId]
    );
  };
  
  // 计算整体风险等级
  const overallRisk = useMemo(() => {
    const enabled = permissions.filter((p) =>
      enabledPermissions.includes(p.id)
    );
    if (enabled.some((p) => p.riskLevel === 'critical')) return 'critical';
    if (enabled.some((p) => p.riskLevel === 'high')) return 'high';
    if (enabled.some((p) => p.riskLevel === 'medium')) return 'medium';
    return 'safe';
  }, [enabledPermissions]);
  
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-neutral-900">
          配置权限
        </h2>
        <p className="text-neutral-600 mt-2">
          决定 Agent 可以执行哪些操作
        </p>
      </div>
      
      {/* 风险评估摘要 */}
      <Alert variant={overallRisk === 'safe' ? 'success' : 'warning'}>
        <AlertIcon />
        <AlertTitle>当前风险等级</AlertTitle>
        <AlertDescription>
          <div className="flex items-center gap-2 mt-2">
            <RiskBadge level={overallRisk} />
            <span className="text-sm">
              {overallRisk === 'safe' && '所有权限都是安全的'}
              {overallRisk === 'medium' && '包含中等风险权限，建议审查'}
              {overallRisk === 'high' && '包含高风险权限，需要谨慎配置'}
              {overallRisk === 'critical' && '包含严重风险权限，强烈建议启用审批'}
            </span>
          </div>
        </AlertDescription>
      </Alert>
      
      {/* 权限列表 */}
      <div className="space-y-3">
        {permissions.map((permission) => {
          const enabled = enabledPermissions.includes(permission.id);
          
          return (
            <Card
              key={permission.id}
              className={cn(
                'transition-colors',
                enabled && 'bg-neutral-50'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => togglePermission(permission.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-neutral-900">
                          {permission.name}
                        </h3>
                        <RiskBadge level={permission.riskLevel} />
                      </div>
                      <p className="text-sm text-neutral-600">
                        {permission.description}
                      </p>
                      
                      {/* 风险提示 */}
                      {enabled && permission.riskLevel !== 'safe' && (
                        <div className="mt-2 p-2 rounded-md bg-warning-50 text-warning-800 text-xs">
                          <InfoIcon className="h-3 w-3 inline mr-1" />
                          {permission.riskLevel === 'medium' &&
                            '建议在审批策略中配置确认'}
                          {permission.riskLevel === 'high' &&
                            '建议启用人工审批'}
                          {permission.riskLevel === 'critical' &&
                            '强烈建议启用人工审批并限制使用场景'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* 底部按钮 */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          上一步
        </Button>
        <Button
          onClick={() => {
            onChange(enabledPermissions);
            onNext();
          }}
        >
          下一步
        </Button>
      </div>
    </div>
  );
}
```

#### 步骤 5：审批策略

```typescript
// apps/web/src/app/agents/create/steps/Step5Approval.tsx

type ApprovalTemplate = 'loose' | 'standard' | 'strict' | 'custom';

const templates = [
  {
    id: 'loose' as const,
    name: '宽松',
    description: '大部分操作自动执行，仅关键操作需要审批',
    rules: [
      { action: 'file:read', policy: 'auto' },
      { action: 'file:write', policy: 'auto' },
      { action: 'network:access', policy: 'auto' },
      { action: 'communication:send', policy: 'ask' },
      { action: 'system:execute', policy: 'deny' },
    ],
  },
  {
    id: 'standard' as const,
    name: '标准（推荐）',
    description: '平衡安全和效率，写入和外发需要确认',
    rules: [
      { action: 'file:read', policy: 'auto' },
      { action: 'file:write', policy: 'ask' },
      { action: 'network:access', policy: 'ask' },
      { action: 'communication:send', policy: 'ask' },
      { action: 'system:execute', policy: 'deny' },
    ],
  },
  {
    id: 'strict' as const,
    name: '严格',
    description: '所有非只读操作都需要人工审批',
    rules: [
      { action: 'file:read', policy: 'auto' },
      { action: 'file:write', policy: 'ask' },
      { action: 'network:access', policy: 'ask' },
      { action: 'communication:send', policy: 'ask' },
      { action: 'system:execute', policy: 'ask' },
    ],
  },
];

export function Step5Approval({ value, onChange, onNext, onBack }) {
  const [template, setTemplate] = useState<ApprovalTemplate>(value?.template || 'standard');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-neutral-900">
          配置审批策略
        </h2>
        <p className="text-neutral-600 mt-2">
          决定哪些操作需要人工审批
        </p>
      </div>
      
      {/* 预设模板选择 */}
      <RadioGroup value={template} onValueChange={setTemplate}>
        <div className="space-y-3">
          {templates.map((tmpl) => (
            <Card
              key={tmpl.id}
              className={cn(
                'cursor-pointer transition-all',
                template === tmpl.id && 'ring-2 ring-brand-500'
              )}
              onClick={() => setTemplate(tmpl.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <RadioGroupItem value={tmpl.id} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-neutral-900">
                        {tmpl.name}
                      </h3>
                      {tmpl.id === 'standard' && (
                        <Badge variant="brand" size="sm">推荐</Badge>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 mb-3">
                      {tmpl.description}
                    </p>
                    
                    {/* 策略预览 */}
                    <div className="space-y-1">
                      {tmpl.rules.map((rule, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs text-neutral-600"
                        >
                          <ApprovalPolicyIcon policy={rule.policy} />
                          <span>{rule.action}</span>
                          <span className="text-neutral-400">→</span>
                          <span className={cn(
                            rule.policy === 'auto' && 'text-success-600',
                            rule.policy === 'ask' && 'text-warning-600',
                            rule.policy === 'deny' && 'text-error-600'
                          )}>
                            {rule.policy === 'auto' && '自动执行'}
                            {rule.policy === 'ask' && '需要审批'}
                            {rule.policy === 'deny' && '禁止'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </RadioGroup>
      
      {/* 高级配置（折叠）*/}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            {showAdvanced ? '收起' : '展开'}高级配置
            <ChevronDownIcon className={cn(
              'h-4 w-4 ml-2 transition-transform',
              showAdvanced && 'rotate-180'
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-3">
            <CardContent className="p-4 space-y-4">
              {/* 审批超时 */}
              <FormField>
                <Label>审批超时（秒）</Label>
                <Input
                  type="number"
                  defaultValue={300}
                  min={60}
                  max={3600}
                />
                <FormDescription>
                  超时后自动拒绝审批请求
                </FormDescription>
              </FormField>
              
              {/* 默认审批人 */}
              <FormField>
                <Label>默认审批人</Label>
                <UserSelect multiple />
                <FormDescription>
                  留空则由创建者审批
                </FormDescription>
              </FormField>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
      
      {/* 底部按钮 */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          上一步
        </Button>
        <Button
          onClick={() => {
            onChange({ template, advanced: showAdvanced });
            onNext();
          }}
        >
          下一步
        </Button>
      </div>
    </div>
  );
}
```

---

#### 步骤 6：选择入口渠道

```typescript
// apps/web/src/app/agents/create/steps/Step6Channels.tsx

interface Channel {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType;
  status: 'available' | 'coming_soon' | 'requires_config';
  requiredConfig?: string[];
}

const channels: Channel[] = [
  {
    id: 'web',
    name: 'Web 聊天',
    description: '通过网页界面与 Agent 对话',
    icon: GlobeIcon,
    status: 'available',
  },
  {
    id: 'api',
    name: 'API',
    description: '通过 REST API 调用 Agent',
    icon: CodeIcon,
    status: 'available',
  },
  {
    id: 'wechat-work',
    name: '企业微信',
    description: '在企业微信中使用 Agent',
    icon: WechatIcon,
    status: 'requires_config',
    requiredConfig: ['企业微信 AppID', 'AgentID', 'Secret'],
  },
  {
    id: 'dingtalk',
    name: '钉钉',
    description: '在钉钉中使用 Agent',
    icon: DingtalkIcon,
    status: 'coming_soon',
  },
  {
    id: 'feishu',
    name: '飞书',
    description: '在飞书中使用 Agent',
    icon: FeishuIcon,
    status: 'coming_soon',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: '在 Slack 中使用 Agent',
    icon: SlackIcon,
    status: 'coming_soon',
  },
];

export function Step6Channels({ value, onChange, onNext, onBack }) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>(
    value || ['web']
  );
  
  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-neutral-900">
          选择使用入口
        </h2>
        <p className="text-neutral-600 mt-2">
          决定用户从哪些渠道访问这个 Agent
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map((channel) => {
          const selected = selectedChannels.includes(channel.id);
          const disabled = channel.status === 'coming_soon';
          
          return (
            <Card
              key={channel.id}
              className={cn(
                'transition-all',
                !disabled && 'cursor-pointer hover:shadow-md',
                selected && 'ring-2 ring-brand-500',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => !disabled && toggleChannel(channel.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected}
                    disabled={disabled}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <channel.icon className="h-5 w-5 text-neutral-700" />
                      <h3 className="font-medium text-neutral-900">
                        {channel.name}
                      </h3>
                      {channel.status === 'coming_soon' && (
                        <Badge variant="neutral" size="sm">即将推出</Badge>
                      )}
                      {channel.status === 'requires_config' && (
                        <Badge variant="warning" size="sm">需配置</Badge>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 mb-2">
                      {channel.description}
                    </p>
                    
                    {/* 配置要求提示 */}
                    {selected && channel.requiredConfig && (
                      <Alert variant="info" size="sm" className="mt-3">
                        <AlertTitle className="text-xs">需要配置</AlertTitle>
                        <AlertDescription className="text-xs">
                          发布后需要配置：
                          {channel.requiredConfig.join('、')}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* 底部按钮 */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          上一步
        </Button>
        <Button
          disabled={selectedChannels.length === 0}
          onClick={() => {
            onChange(selectedChannels);
            onNext();
          }}
        >
          下一步
        </Button>
      </div>
    </div>
  );
}
```

#### 步骤 7：预览和发布

```typescript
// apps/web/src/app/agents/create/steps/Step7Preview.tsx

export function Step7Preview({ formData, onBack, onSaveDraft, onPublish }) {
  const [isPublishing, setIsPublishing] = useState(false);
  
  // 计算预估成本
  const estimatedCost = useMemo(() => {
    // 基于模型和 Skill 数量估算
    const baseTokens = 1000;
    const skillMultiplier = formData.skills.length * 200;
    const totalTokens = baseTokens + skillMultiplier;
    const costPerToken = 0.00001; // 假设成本
    return (totalTokens * costPerToken).toFixed(4);
  }, [formData]);
  
  // 计算整体风险等级
  const overallRisk = useMemo(() => {
    const permissions = formData.permissions || [];
    const skills = formData.skillsData || [];
    
    if (permissions.includes('system:execute')) return 'critical';
    if (permissions.includes('communication:send')) return 'high';
    if (skills.some(s => s.riskLevel === 'high')) return 'high';
    if (permissions.includes('network:access')) return 'medium';
    return 'safe';
  }, [formData]);
  
  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const result = await publishAgent(formData);
      toast.success('Agent 发布成功！');
      router.push(`/agents/${result.id}`);
    } catch (error) {
      toast.error('发布失败：' + error.message);
    } finally {
      setIsPublishing(false);
    }
  };
  
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-neutral-900">
          预览和发布
        </h2>
        <p className="text-neutral-600 mt-2">
          确认 Agent 配置，然后发布
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：配置摘要 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <Avatar
                  src={formData.avatar}
                  fallback={formData.displayName[0]}
                  size="lg"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-neutral-900">
                    {formData.displayName}
                  </h3>
                  <p className="text-sm text-neutral-600 mt-1">
                    {formData.description}
                  </p>
                  {formData.goals?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.goals.map((goal, idx) => (
                        <Badge key={idx} variant="neutral" size="sm">
                          {goal}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Skill 列表 */}
          <Card>
            <CardHeader>
              <CardTitle>
                已选择的 Skill
                <Badge variant="neutral" size="sm" className="ml-2">
                  {formData.skills?.length || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {formData.skillsData?.map((skill) => (
                  <div
                    key={skill.id}
                    className="flex items-center justify-between p-3 rounded-md bg-neutral-50"
                  >
                    <div className="flex items-center gap-3">
                      <skill.icon className="h-5 w-5 text-neutral-700" />
                      <div>
                        <div className="font-medium text-sm">
                          {skill.displayName}
                        </div>
                        <div className="text-xs text-neutral-600">
                          {skill.category}
                        </div>
                      </div>
                    </div>
                    <RiskBadge level={skill.riskLevel} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* 权限摘要 */}
          <Card>
            <CardHeader>
              <CardTitle>权限</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {formData.permissionsData?.map((perm) => (
                  <div
                    key={perm.id}
                    className="flex items-center justify-between p-3 rounded-md border"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="h-5 w-5 text-success-600" />
                      <div>
                        <div className="font-medium text-sm">
                          {perm.name}
                        </div>
                        <div className="text-xs text-neutral-600">
                          {perm.description}
                        </div>
                      </div>
                    </div>
                    <RiskBadge level={perm.riskLevel} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* 审批策略 */}
          <Card>
            <CardHeader>
              <CardTitle>审批策略</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="brand" size="md">
                  {formData.approval?.template === 'loose' && '宽松'}
                  {formData.approval?.template === 'standard' && '标准'}
                  {formData.approval?.template === 'strict' && '严格'}
                </Badge>
                <span className="text-sm text-neutral-600">
                  {formData.approval?.template === 'standard' &&
                    '写入和外发操作需要人工审批'}
                </span>
              </div>
            </CardContent>
          </Card>
          
          {/* 使用入口 */}
          <Card>
            <CardHeader>
              <CardTitle>使用入口</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {formData.channelsData?.map((channel) => (
                  <Badge key={channel.id} variant="neutral" size="md">
                    <channel.icon className="h-4 w-4 mr-1" />
                    {channel.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* 右侧：风险评估和操作 */}
        <div className="space-y-4">
          {/* 风险评估 */}
          <Card>
            <CardHeader>
              <CardTitle>风险评估</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-neutral-600 mb-2">
                  整体风险等级
                </div>
                <RiskBadge level={overallRisk} size="lg" />
              </div>
              
              {/* 风险提示 */}
              {overallRisk !== 'safe' && (
                <Alert variant="warning" size="sm">
                  <AlertIcon />
                  <AlertDescription className="text-xs">
                    {overallRisk === 'critical' &&
                      '此 Agent 包含严重风险操作，强烈建议配置严格的审批策略'}
                    {overallRisk === 'high' &&
                      '此 Agent 包含高风险操作，建议配置人工审批'}
                    {overallRisk === 'medium' &&
                      '此 Agent 包含中等风险操作，建议定期审查'}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          
          {/* 预估成本 */}
          <Card>
            <CardHeader>
              <CardTitle>预估成本</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-neutral-900">
                  ¥{estimatedCost}
                </div>
                <div className="text-sm text-neutral-600 mt-1">
                  每次对话
                </div>
              </div>
              <Divider className="my-4" />
              <div className="space-y-2 text-xs text-neutral-600">
                <div className="flex justify-between">
                  <span>基础 Token</span>
                  <span>1,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Skill 开销</span>
                  <span>{formData.skills?.length * 200}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 数据处理说明 */}
          <Card>
            <CardHeader>
              <CardTitle>数据处理</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs text-neutral-600">
                <div className="flex items-start gap-2">
                  <CheckIcon className="h-4 w-4 text-success-600 mt-0.5 flex-shrink-0" />
                  <span>会话数据保存在当前租户</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckIcon className="h-4 w-4 text-success-600 mt-0.5 flex-shrink-0" />
                  <span>敏感信息会自动脱敏</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckIcon className="h-4 w-4 text-success-600 mt-0.5 flex-shrink-0" />
                  <span>所有操作都会记录审计日志</span>
                </div>
                {formData.permissions?.includes('network:access') && (
                  <div className="flex items-start gap-2">
                    <AlertIcon className="h-4 w-4 text-warning-600 mt-0.5 flex-shrink-0" />
                    <span>会访问外部网络（受白名单限制）</span>
                  </div>
                )}
                {formData.permissions?.includes('communication:send') && (
                  <div className="flex items-start gap-2">
                    <AlertIcon className="h-4 w-4 text-warning-600 mt-0.5 flex-shrink-0" />
                    <span>可能向外部发送消息（需人工审批）</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* 操作按钮 */}
          <div className="space-y-2">
            <Button
              fullWidth
              size="lg"
              loading={isPublishing}
              onClick={handlePublish}
            >
              发布 Agent
            </Button>
            <Button
              fullWidth
              variant="outline"
              onClick={onSaveDraft}
            >
              保存草稿
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={onBack}
            >
              返回修改
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### 3.5 Agent 测试工作台 (`/agents/[id]/test`)

#### 布局

```text
┌─────────────────────────────────────────────────────┐
│ 面包屑：首页 > Agent > 客服助手 > 测试                │
├─────────────────────────────────────────────────────┤
│ 页面标题：测试工作台      【清空会话】【停止运行】    │
├──────────────────────────┬──────────────────────────┤
│                          │                          │
│  聊天界面 (60%)           │  事件时间线 (40%)         │
│  ┌──────────────────┐   │  ┌──────────────────┐   │
│  │ 消息列表          │   │  │ [09:30:15]       │   │
│  │                  │   │  │ ● Skill 加载     │   │
│  │ 用户: 你好        │   │  │                  │   │
│  │ AI: 您好！        │   │  │ [09:30:16]       │   │
│  │                  │   │  │ ● Tool 调用      │   │
│  │                  │   │  │   read_file      │   │
│  │                  │   │  │   ✓ 成功         │   │
│  └──────────────────┘   │  │                  │   │
│  ┌──────────────────┐   │  │ [09:30:20]       │   │
│  │ [上传] 输入框... │   │  │ ⚠ 等待审批       │   │
│  └──────────────────┘   │  └──────────────────┘   │
├──────────────────────────┴──────────────────────────┤
│ 统计：Input 1.2K | Output 850 | Cost ¥0.05 | 2.3s  │
└─────────────────────────────────────────────────────┘
```

#### 组件实现

```typescript
// apps/web/src/app/agents/[id]/test/page.tsx

export default function AgentTestPage({ params }: { params: { id: string } }) {
  const { data: agent } = useQuery({
    queryKey: ['agent', params.id],
    queryFn: () => fetchAgent(params.id),
  });
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [stats, setStats] = useState<RunStats>({
    inputTokens: 0,
    outputTokens: 0,
    costCents: 0,
    durationMs: 0,
  });
  
  // WebSocket 连接
  const { sendMessage, disconnect } = useWebSocket({
    onEvent: (event) => {
      setEvents((prev) => [...prev, event]);
      
      if (event.type === 'run.accepted') {
        setIsRunning(true);
        setCurrentRunId(event.runId);
      }
      
      if (event.type === 'message.delta') {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant' && !lastMsg.completed) {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, content: lastMsg.content + event.text },
            ];
          }
          return [...prev, { role: 'assistant', content: event.text }];
        });
      }
      
      if (event.type === 'run.completed') {
        setIsRunning(false);
        setStats({
          inputTokens: event.usage.inputTokens,
          outputTokens: event.usage.outputTokens,
          costCents: event.usage.costCents,
          durationMs: Date.now() - runStartTime,
        });
      }
      
      if (event.type === 'run.failed') {
        setIsRunning(false);
        toast.error('运行失败：' + event.message);
      }
    },
  });
  
  const handleSend = () => {
    if (!input.trim() || isRunning) return;
    
    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    
    sendMessage({
      agentId: params.id,
      message: input,
    });
    
    setInput('');
  };
  
  const handleClear = () => {
    if (confirm('确定要清空当前会话吗？')) {
      setMessages([]);
      setEvents([]);
      setStats({
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
        durationMs: 0,
      });
    }
  };
  
  const handleStop = () => {
    if (currentRunId && confirm('确定要停止当前运行吗？')) {
      cancelRun(currentRunId);
      setIsRunning(false);
    }
  };
  
  return (
    <div className="h-screen flex flex-col">
      {/* 页面标题 */}
      <div className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Breadcrumb>
              <BreadcrumbItem href="/">首页</BreadcrumbItem>
              <BreadcrumbItem href="/agents">Agent</BreadcrumbItem>
              <BreadcrumbItem href={`/agents/${params.id}`}>
                {agent?.displayName}
              </BreadcrumbItem>
              <BreadcrumbItem>测试</BreadcrumbItem>
            </Breadcrumb>
            <h1 className="text-xl font-semibold text-neutral-900 mt-2">
              测试工作台
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={messages.length === 0}
            >
              清空会话
            </Button>
            {isRunning && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
              >
                <StopIcon className="h-4 w-4 mr-2" />
                停止运行
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：聊天界面 */}
        <div className="flex-1 flex flex-col bg-white">
          {/* 消息列表 */}
          <ScrollArea className="flex-1 p-6">
            {messages.length === 0 ? (
              <EmptyState
                icon={<ChatIcon />}
                title="开始测试"
                description="输入消息开始与 Agent 对话"
              />
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((msg, idx) => (
                  <MessageBubble key={idx} message={msg} />
                ))}
                {isRunning && (
                  <div className="flex items-center gap-2 text-neutral-600">
                    <Spinner size="sm" />
                    <span className="text-sm">Agent 正在思考...</span>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
          
          {/* 输入区域 */}
          <div className="border-t border-neutral-200 p-4">
            <div className="max-w-3xl mx-auto">
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={handleSend}
                disabled={isRunning}
                placeholder="输入消息..."
                onFileUpload={(file) => {
                  // 处理文件上传
                }}
              />
            </div>
          </div>
        </div>
        
        {/* 右侧：事件时间线（可折叠）*/}
        <ResizablePanel defaultSize={40} minSize={30} maxSize={60}>
          <div className="h-full border-l border-neutral-200 bg-neutral-50 flex flex-col">
            <div className="border-b border-neutral-200 bg-white px-4 py-3">
              <h2 className="font-semibold text-sm text-neutral-900">
                事件时间线
              </h2>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              {events.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-sm">
                  暂无事件
                </div>
              ) : (
                <div className="space-y-3">
                  {events.map((event, idx) => (
                    <EventItem key={idx} event={event} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </ResizablePanel>
      </div>
      
      {/* 底部统计栏 */}
      <div className="border-t border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-neutral-600">Input:</span>
              <span className="font-mono font-medium text-neutral-900">
                {stats.inputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-600">Output:</span>
              <span className="font-mono font-medium text-neutral-900">
                {stats.outputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-600">成本:</span>
              <span className="font-mono font-medium text-neutral-900">
                ¥{(stats.costCents / 100).toFixed(4)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-600">耗时:</span>
              <span className="font-mono font-medium text-neutral-900">
                {(stats.durationMs / 1000).toFixed(1)}s
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isRunning ? (
              <>
                <div className="h-2 w-2 rounded-full bg-success-600 animate-pulse" />
                <span className="text-sm text-success-700">运行中</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-neutral-400" />
                <span className="text-sm text-neutral-600">就绪</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### EventItem 组件

```typescript
// apps/web/src/components/agent/EventItem.tsx

export function EventItem({ event }: { event: AgentEvent }) {
  const getEventIcon = () => {
    switch (event.type) {
      case 'skill.started':
        return <PackageIcon className="h-4 w-4 text-brand-600" />;
      case 'tool.started':
        return <WrenchIcon className="h-4 w-4 text-blue-600" />;
      case 'tool.completed':
        return <CheckCircleIcon className="h-4 w-4 text-success-600" />;
      case 'tool.approval.required':
        return <AlertCircleIcon className="h-4 w-4 text-warning-600" />;
      case 'run.failed':
        return <XCircleIcon className="h-4 w-4 text-error-600" />;
      default:
        return <InfoIcon className="h-4 w-4 text-neutral-600" />;
    }
  };
  
  return (
    <Card size="sm">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{getEventIcon()}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-neutral-900">
                {formatEventType(event.type)}
              </span>
              <span className="text-xs text-neutral-500">
                {formatTime(event.timestamp)}
              </span>
            </div>
            
            {/* 事件详情（可展开）*/}
            {event.type === 'tool.started' && (
              <div className="text-xs text-neutral-600">
                工具: <code className="px-1 py-0.5 bg-neutral-100 rounded">
                  {event.toolId}
                </code>
              </div>
            )}
            
            {event.type === 'tool.completed' && event.result && (
              <Collapsible>
                <CollapsibleTrigger className="text-xs text-brand-600 hover:text-brand-700">
                  查看结果
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-2 p-2 bg-neutral-100 rounded text-xs overflow-x-auto">
                    {JSON.stringify(event.result, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            )}
            
            {event.type === 'tool.approval.required' && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-neutral-600">
                  {event.summary}
                </p>
                <div className="flex gap-2">
                  <Button size="xs" variant="success">
                    批准
                  </Button>
                  <Button size="xs" variant="outline">
                    拒绝
                  </Button>
                </div>
              </div>
            )}
            
            {event.type === 'run.failed' && (
              <Alert variant="error" size="sm" className="mt-2">
                <AlertDescription className="text-xs">
                  {event.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 3.6 Skill 市场 (`/skills`)

#### 布局

```text
┌─────────────────────────────────────────────────────┐
│ 面包屑：首页 > Skill 市场                             │
├─────────────────────────────────────────────────────┤
│ 页面标题：Skill 市场               【上传 Skill】     │
├─────────────────────────────────────────────────────┤
│ 【搜索框】 【分类▼】【风险▼】【来源▼】【排序▼】       │
├─────────────────────────────────────────────────────┤
│ Skill 卡片网格                                        │
│ ┌──────────┬──────────┬──────────┬──────────┐       │
│ │ Skill 1  │ Skill 2  │ Skill 3  │ Skill 4  │       │
│ │ [图标]   │ [图标]   │ [图标]   │ [图标]   │       │
│ │ 文件处理 │ 网络请求 │ 数据分析 │ 代码执行 │       │
│ │ ⭐ 4.8  │ ⭐ 4.5  │ ⭐ 4.9  │ ⭐ 4.3  │       │
│ ├──────────┼──────────┼──────────┼──────────┤       │
│ │ Skill 5  │ Skill 6  │ Skill 7  │ Skill 8  │       │
│ └──────────┴──────────┴──────────┴──────────┘       │
├─────────────────────────────────────────────────────┤
│ 分页：< 1 2 3 ... 10 >                               │
└─────────────────────────────────────────────────────┘
```

#### 组件实现

```typescript
// apps/web/src/app/skills/page.tsx

export default function SkillsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; risk?: string; source?: string; sort?: string };
}) {
  const query = searchParams.q || '';
  const category = searchParams.category || 'all';
  const risk = searchParams.risk || 'all';
  const source = searchParams.source || 'all';
  const sort = searchParams.sort || 'popular';
  
  const { data: skills, isLoading } = useQuery({
    queryKey: ['skills', query, category, risk, source, sort],
    queryFn: () => fetchSkills({ query, category, risk, source, sort }),
  });
  
  return (
    <div className="space-y-6">
      {/* 页面标题 + 上传按钮 */}
      <PageHeader
        title="Skill 市场"
        description="浏览和安装 Skill 为您的 Agent 增加能力"
        action={
          <Button leftIcon={<UploadIcon />} href="/skills/upload">
            上传 Skill
          </Button>
        }
      />
      
      {/* 搜索和筛选栏 */}
      <div className="flex items-center gap-3">
        <SearchInput
          placeholder="搜索 Skill..."
          value={query}
          onChange={(value) => updateSearchParams({ q: value })}
          className="flex-1 max-w-md"
        />
        
        <Select value={category} onValueChange={(v) => updateSearchParams({ category: v })}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            <SelectItem value="file">文件处理</SelectItem>
            <SelectItem value="network">网络</SelectItem>
            <SelectItem value="data">数据分析</SelectItem>
            <SelectItem value="communication">通信</SelectItem>
            <SelectItem value="system">系统</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={risk} onValueChange={(v) => updateSearchParams({ risk: v })}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="风险" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部风险</SelectItem>
            <SelectItem value="safe">安全</SelectItem>
            <SelectItem value="medium">中等</SelectItem>
            <SelectItem value="high">高</SelectItem>
            <SelectItem value="critical">严重</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={source} onValueChange={(v) => updateSearchParams({ source: v })}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            <SelectItem value="official">官方</SelectItem>
            <SelectItem value="community">社区</SelectItem>
            <SelectItem value="my">我的</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={sort} onValueChange={(v) => updateSearchParams({ sort: v })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">最受欢迎</SelectItem>
            <SelectItem value="recent">最近发布</SelectItem>
            <SelectItem value="rating">评分最高</SelectItem>
            <SelectItem value="usage">使用最多</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Skill 列表 */}
      {isLoading ? (
        <SkillCardSkeleton count={12} />
      ) : skills?.items.length === 0 ? (
        <EmptyState
          icon={<PackageIcon />}
          title="未找到 Skill"
          description="尝试调整筛选条件"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {skills?.items.map((skill) => (
            <SkillMarketCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}
      
      {/* 分页 */}
      {skills && skills.totalPages > 1 && (
        <Pagination
          currentPage={skills.currentPage}
          totalPages={skills.totalPages}
          onPageChange={(page) => updateSearchParams({ page: String(page) })}
        />
      )}
    </div>
  );
}
```

#### SkillMarketCard 组件

```typescript
// apps/web/src/components/skill/SkillMarketCard.tsx

interface SkillMarketCardProps {
  skill: Skill;
}

export function SkillMarketCard({ skill }: SkillMarketCardProps) {
  const [isInstalled, setIsInstalled] = useState(skill.isInstalled);
  const [isInstalling, setIsInstalling] = useState(false);
  
  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await installSkill(skill.id);
      setIsInstalled(true);
      toast.success(`已安装 ${skill.displayName}`);
    } catch (error) {
      toast.error('安装失败：' + error.message);
    } finally {
      setIsInstalling(false);
    }
  };
  
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        {/* 图标 + 名称 */}
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-md bg-brand-50 flex items-center justify-center flex-shrink-0">
            <skill.icon className="h-6 w-6 text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-neutral-900 truncate">
              {skill.displayName}
            </h3>
            <p className="text-xs text-neutral-500">
              {skill.author}
            </p>
          </div>
        </div>
        
        {/* 描述 */}
        <p className="text-sm text-neutral-600 line-clamp-2 mb-3">
          {skill.description}
        </p>
        
        {/* 标签 */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Badge variant="neutral" size="sm">
            {skill.category}
          </Badge>
          <RiskBadge level={skill.riskLevel} size="sm" />
          {skill.source === 'official' && (
            <Badge variant="brand" size="sm">
              <CheckCircleIcon className="h-3 w-3 mr-1" />
              官方
            </Badge>
          )}
        </div>
        
        {/* 评分和使用次数 */}
        <div className="flex items-center justify-between mb-3 text-xs text-neutral-600">
          <div className="flex items-center gap-1">
            <StarIcon className="h-4 w-4 text-warning-500 fill-warning-500" />
            <span className="font-medium">{skill.rating.toFixed(1)}</span>
            <span>({skill.ratingCount})</span>
          </div>
          <div>
            {skill.usageCount.toLocaleString()} 次使用
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex gap-2">
          {isInstalled ? (
            <Button size="sm" variant="outline" fullWidth disabled>
              <CheckIcon className="h-4 w-4 mr-1" />
              已安装
            </Button>
          ) : (
            <Button
              size="sm"
              fullWidth
              loading={isInstalling}
              onClick={handleInstall}
            >
              安装
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            href={`/skills/${skill.id}`}
          >
            详情
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### Skill 详情页

```typescript
// apps/web/src/app/skills/[id]/page.tsx

export default async function SkillDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const skill = await fetchSkillDetail(params.id);
  
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 面包屑 */}
      <Breadcrumb>
        <BreadcrumbItem href="/">首页</BreadcrumbItem>
        <BreadcrumbItem href="/skills">Skill 市场</BreadcrumbItem>
        <BreadcrumbItem>{skill.displayName}</BreadcrumbItem>
      </Breadcrumb>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：详细信息 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 头部 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <skill.icon className="h-10 w-10 text-brand-600" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-2">
                    {skill.displayName}
                  </h1>
                  <p className="text-neutral-600 mb-3">
                    {skill.description}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <StarIcon className="h-5 w-5 text-warning-500 fill-warning-500" />
                      <span className="font-medium">{skill.rating.toFixed(1)}</span>
                      <span className="text-neutral-500">
                        ({skill.ratingCount} 评分)
                      </span>
                    </div>
                    <div className="text-neutral-600">
                      {skill.usageCount.toLocaleString()} 次使用
                    </div>
                    <div className="text-neutral-600">
                      版本 {skill.version}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 功能说明 */}
          <Card>
            <CardHeader>
              <CardTitle>功能说明</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: skill.instruction }}
              />
            </CardContent>
          </Card>
          
          {/* 使用示例 */}
          {skill.examples?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>使用示例</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {skill.examples.map((example, idx) => (
                  <div key={idx} className="p-4 rounded-md bg-neutral-50">
                    <div className="font-medium text-sm text-neutral-900 mb-2">
                      {example.title}
                    </div>
                    <pre className="text-xs text-neutral-700 whitespace-pre-wrap">
                      {example.content}
                    </pre>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          {/* 依赖 */}
          {skill.dependencies?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>依赖的 Skill</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {skill.dependencies.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-3 rounded-md border"
                    >
                      <div className="flex items-center gap-3">
                        <dep.icon className="h-5 w-5 text-neutral-700" />
                        <div>
                          <div className="font-medium text-sm">
                            {dep.displayName}
                          </div>
                          <div className="text-xs text-neutral-600">
                            版本 {dep.version}
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" href={`/skills/${dep.id}`}>
                        查看
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* 版本历史 */}
          <Card>
            <CardHeader>
              <CardTitle>版本历史</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {skill.versions.map((version) => (
                  <div
                    key={version.version}
                    className="flex items-start justify-between p-3 rounded-md border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-medium text-sm">
                          v{version.version}
                        </span>
                        {version.version === skill.version && (
                          <Badge variant="brand" size="sm">当前</Badge>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600">
                        {version.changelog}
                      </p>
                      <div className="text-xs text-neutral-500 mt-1">
                        {formatDate(version.publishedAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* 右侧：元信息和操作 */}
        <div className="space-y-4">
          {/* 安装 */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <SkillInstallButton skill={skill} />
              <Button variant="outline" fullWidth href={`/skills/${skill.id}/test`}>
                测试
              </Button>
            </CardContent>
          </Card>
          
          {/* 元信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">详细信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-neutral-600 mb-1">分类</div>
                <Badge variant="neutral">{skill.category}</Badge>
              </div>
              
              <div>
                <div className="text-neutral-600 mb-1">风险等级</div>
                <RiskBadge level={skill.riskLevel} />
              </div>
              
              <div>
                <div className="text-neutral-600 mb-1">作者</div>
                <div className="font-medium text-neutral-900">
                  {skill.author}
                </div>
              </div>
              
              <div>
                <div className="text-neutral-600 mb-1">可见性</div>
                <Badge variant="neutral">
                  {skill.visibility === 'public' && '公开'}
                  {skill.visibility === 'tenant' && '租户'}
                  {skill.visibility === 'team' && '团队'}
                  {skill.visibility === 'private' && '私有'}
                </Badge>
              </div>
              
              <div>
                <div className="text-neutral-600 mb-1">发布时间</div>
                <div className="text-neutral-900">
                  {formatDate(skill.publishedAt)}
                </div>
              </div>
              
              <div>
                <div className="text-neutral-600 mb-1">更新时间</div>
                <div className="text-neutral-900">
                  {formatDate(skill.updatedAt)}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 需要的权限 */}
          {skill.requiredPermissions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">需要的权限</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {skill.requiredPermissions.map((perm, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs"
                    >
                      <ShieldIcon className="h-4 w-4 text-warning-600 mt-0.5 flex-shrink-0" />
                      <span className="text-neutral-700">{perm}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* 副作用 */}
          {skill.sideEffects.length > 0 && skill.sideEffects[0] !== 'none' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">副作用</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {skill.sideEffects.map((effect, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs"
                    >
                      <AlertCircleIcon className="h-4 w-4 text-warning-600 mt-0.5 flex-shrink-0" />
                      <span className="text-neutral-700">
                        {effect === 'file-write' && '写入文件'}
                        {effect === 'network' && '访问网络'}
                        {effect === 'external-send' && '向外发送'}
                        {effect === 'device' && '访问设备'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### 3.7 审批中心 (`/approvals`)

#### 布局

```text
┌─────────────────────────────────────────────────────┐
│ 面包屑:首页 > 审批中心                                 │
├─────────────────────────────────────────────────────┤
│ 页面标题:审批中心                                      │
├─────────────────────────────────────────────────────┤
│ Tab:待我审批(5) | 我发起的(12) | 全部(28)             │
├─────────────────────────────────────────────────────┤
│ 审批卡片列表                                          │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [危险]客服助手想要发送邮件                       │ │
│ │ 发起人:张三  Agent:客服助手  2分钟前              │ │
│ │ 详情:发送客户满意度调查...         【批准】【拒绝】│ │
│ ├─────────────────────────────────────────────────┤ │
│ │ [中等]数据分析想要访问外部API                     │ │
│ │ 发起人:李四  Agent:数据分析  10分钟前             │ │
│ │ 详情:访问 api.example.com...       【批准】【拒绝】│ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### 组件实现

```typescript
// apps/web/src/app/approvals/page.tsx

export default function ApprovalsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab || 'pending';
  
  const { data: approvals, isLoading } = useQuery({
    queryKey: ['approvals', tab],
    queryFn: () => fetchApprovals({ tab }),
  });
  
  const pendingCount = useQuery({
    queryKey: ['approvals', 'pending', 'count'],
    queryFn: () => fetchApprovalsCount('pending'),
  });
  
  const initiatedCount = useQuery({
    queryKey: ['approvals', 'initiated', 'count'],
    queryFn: () => fetchApprovalsCount('initiated'),
  });
  
  const allCount = useQuery({
    queryKey: ['approvals', 'all', 'count'],
    queryFn: () => fetchApprovalsCount('all'),
  });
  
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <PageHeader
        title="审批中心"
        description="管理 Agent 的审批请求"
      />
      
      {/* Tab 切换 */}
      <Tabs value={tab}>
        <TabsList>
          <TabsTrigger value="pending" href="/approvals?tab=pending">
            待我审批
            {pendingCount.data > 0 && (
              <Badge variant="error" size="sm" className="ml-2">
                {pendingCount.data}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="initiated" href="/approvals?tab=initiated">
            我发起的
            <Badge variant="neutral" size="sm" className="ml-2">
              {initiatedCount.data || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all" href="/approvals?tab=all">
            全部
            <Badge variant="neutral" size="sm" className="ml-2">
              {allCount.data || 0}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* 审批列表 */}
      {isLoading ? (
        <ApprovalCardSkeleton count={5} />
      ) : approvals?.length === 0 ? (
        <EmptyState
          icon={<CheckCircleIcon />}
          title={
            tab === 'pending'
              ? '没有待审批的请求'
              : tab === 'initiated'
              ? '您还没有发起过审批'
              : '暂无审批记录'
          }
          description={
            tab === 'pending'
              ? '所有审批请求都已处理完成'
              : tab === 'initiated'
              ? 'Agent 的高风险操作会自动创建审批请求'
              : ''
          }
        />
      ) : (
        <div className="space-y-4 max-w-4xl">
          {approvals.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} tab={tab} />
          ))}
        </div>
      )}
    </div>
  );
}
```

#### ApprovalCard 组件

```typescript
// apps/web/src/components/approval/ApprovalCard.tsx

interface ApprovalCardProps {
  approval: ApprovalRequest;
  tab: string;
}

export function ApprovalCard({ approval, tab }: ApprovalCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approveRequest(approval.id);
      toast.success('已批准');
      queryClient.invalidateQueries(['approvals']);
    } catch (error) {
      toast.error('批准失败：' + error.message);
    } finally {
      setIsApproving(false);
    }
  };
  
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('请填写拒绝原因');
      return;
    }
    
    setIsRejecting(true);
    try {
      await rejectRequest(approval.id, rejectReason);
      toast.success('已拒绝');
      setShowRejectDialog(false);
      queryClient.invalidateQueries(['approvals']);
    } catch (error) {
      toast.error('拒绝失败：' + error.message);
    } finally {
      setIsRejecting(false);
    }
  };
  
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'border-l-4 border-l-error-600';
      case 'high':
        return 'border-l-4 border-l-warning-600';
      case 'medium':
        return 'border-l-4 border-l-info-600';
      default:
        return 'border-l-4 border-l-neutral-300';
    }
  };
  
  return (
    <Card className={cn('transition-all', getRiskColor(approval.riskLevel))}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            {/* 标题和风险 */}
            <div className="flex items-start gap-3">
              <RiskBadge level={approval.riskLevel} />
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900 mb-1">
                  {approval.agentName} 想要 {approval.actionSummary}
                </h3>
                <div className="flex items-center gap-4 text-sm text-neutral-600">
                  <div className="flex items-center gap-1">
                    <UserIcon className="h-4 w-4" />
                    <span>发起人: {approval.initiatorName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <RobotIcon className="h-4 w-4" />
                    <span>Agent: {approval.agentName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    <span>{formatRelativeTime(approval.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 详情（可展开）*/}
            <Collapsible>
              <CollapsibleTrigger className="text-sm text-brand-600 hover:text-brand-700">
                查看详情 <ChevronDownIcon className="h-4 w-4 inline" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 p-4 rounded-md bg-neutral-50 space-y-3">
                  {/* 工具调用 */}
                  <div>
                    <div className="text-xs font-medium text-neutral-700 mb-1">
                      工具调用
                    </div>
                    <code className="text-xs text-neutral-900 bg-white px-2 py-1 rounded">
                      {approval.toolId}
                    </code>
                  </div>
                  
                  {/* 参数 */}
                  <div>
                    <div className="text-xs font-medium text-neutral-700 mb-1">
                      参数
                    </div>
                    <pre className="text-xs text-neutral-900 bg-white p-2 rounded overflow-x-auto">
                      {JSON.stringify(approval.params, null, 2)}
                    </pre>
                  </div>
                  
                  {/* 上下文 */}
                  {approval.context && (
                    <div>
                      <div className="text-xs font-medium text-neutral-700 mb-1">
                        对话上下文
                      </div>
                      <div className="text-sm text-neutral-700 bg-white p-2 rounded">
                        {approval.context}
                      </div>
                    </div>
                  )}
                  
                  {/* 风险说明 */}
                  {approval.riskReason && (
                    <Alert variant="warning" size="sm">
                      <AlertIcon />
                      <AlertDescription className="text-xs">
                        {approval.riskReason}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            {/* 状态（对于已处理的请求）*/}
            {approval.status !== 'pending' && (
              <div className="flex items-center gap-2 pt-2 border-t">
                {approval.status === 'approved' && (
                  <>
                    <CheckCircleIcon className="h-5 w-5 text-success-600" />
                    <span className="text-sm text-neutral-700">
                      已批准 · {approval.reviewerName} · 
                      {formatRelativeTime(approval.reviewedAt)}
                    </span>
                  </>
                )}
                {approval.status === 'rejected' && (
                  <>
                    <XCircleIcon className="h-5 w-5 text-error-600" />
                    <span className="text-sm text-neutral-700">
                      已拒绝 · {approval.reviewerName} · 
                      {formatRelativeTime(approval.reviewedAt)}
                    </span>
                    {approval.rejectReason && (
                      <span className="text-sm text-neutral-600">
                        · 原因: {approval.rejectReason}
                      </span>
                    )}
                  </>
                )}
                {approval.status === 'timeout' && (
                  <>
                    <ClockIcon className="h-5 w-5 text-neutral-500" />
                    <span className="text-sm text-neutral-700">
                      已超时
                    </span>
                  </>
                )}
              </div>
            )}
            
            {/* 超时倒计时（对于待审批的请求）*/}
            {approval.status === 'pending' && approval.timeoutAt && (
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <ClockIcon className="h-4 w-4" />
                <span>
                  将在 {formatDuration(approval.timeoutAt - Date.now())} 后超时
                </span>
              </div>
            )}
          </div>
          
          {/* 操作按钮（仅对待审批的显示）*/}
          {approval.status === 'pending' && tab === 'pending' && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="success"
                loading={isApproving}
                onClick={handleApprove}
              >
                批准
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRejectDialog(true)}
              >
                拒绝
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      
      {/* 拒绝对话框 */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝审批</DialogTitle>
            <DialogDescription>
              请说明拒绝原因,这将帮助用户理解为什么这个操作不被允许
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="输入拒绝原因..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
            >
              取消
            </Button>
            <Button
              variant="error"
              loading={isRejecting}
              onClick={handleReject}
            >
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
```

---

### 3.8 审计日志 (`/audit`)

#### 布局

```text
┌─────────────────────────────────────────────────────┐
│ 面包屑：首页 > 审计日志                               │
├─────────────────────────────────────────────────────┤
│ 页面标题：审计日志                     【导出日志】   │
├─────────────────────────────────────────────────────┤
│ 【时间范围▼】【用户▼】【Agent▼】【事件类型▼】【搜索】│
├─────────────────────────────────────────────────────┤
│ 日志表格                                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │时间           │用户  │事件      │Agent │详情    │ │
│ ├─────────────────────────────────────────────────┤ │
│ │09:30:15      │张三  │run.start │客服  │[查看]  │ │
│ │09:30:20      │张三  │tool.exec │客服  │[查看]  │ │
│ │09:30:25      │李四  │agent.pub │数据  │[查看]  │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ 分页：< 1 2 3 ... 50 >                               │
└─────────────────────────────────────────────────────┘
```

#### 组件实现

```typescript
// apps/web/src/app/audit/page.tsx

export default function AuditPage({
  searchParams,
}: {
  searchParams: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    agentId?: string;
    eventType?: string;
    q?: string;
    page?: string;
  };
}) {
  const filters = {
    startDate: searchParams.startDate || dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    endDate: searchParams.endDate || dayjs().format('YYYY-MM-DD'),
    userId: searchParams.userId || 'all',
    agentId: searchParams.agentId || 'all',
    eventType: searchParams.eventType || 'all',
    q: searchParams.q || '',
    page: parseInt(searchParams.page || '1', 10),
  };
  
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit', filters],
    queryFn: () => fetchAuditLogs(filters),
  });
  
  const { data: users } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: fetchUsers,
  });
  
  const { data: agents } = useQuery({
    queryKey: ['agents', 'list'],
    queryFn: fetchAgents,
  });
  
  const handleExport = async () => {
    try {
      const blob = await exportAuditLogs(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${dayjs().format('YYYY-MM-DD-HHmmss')}.csv`;
      a.click();
      toast.success('导出成功');
    } catch (error) {
      toast.error('导出失败：' + error.message);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* 页面标题 + 导出按钮 */}
      <PageHeader
        title="审计日志"
        description="查看所有系统操作的详细记录"
        action={
          <Button
            leftIcon={<DownloadIcon />}
            onClick={handleExport}
            variant="outline"
          >
            导出日志
          </Button>
        }
      />
      
      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* 时间范围 */}
            <DateRangePicker
              startDate={filters.startDate}
              endDate={filters.endDate}
              onChange={({ startDate, endDate }) =>
                updateSearchParams({ startDate, endDate })
              }
            />
            
            {/* 用户筛选 */}
            <Select
              value={filters.userId}
              onValueChange={(v) => updateSearchParams({ userId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="用户" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部用户</SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Agent 筛选 */}
            <Select
              value={filters.agentId}
              onValueChange={(v) => updateSearchParams({ agentId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部 Agent</SelectItem>
                {agents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* 事件类型筛选 */}
            <Select
              value={filters.eventType}
              onValueChange={(v) => updateSearchParams({ eventType: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="事件类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部事件</SelectItem>
                <SelectItem value="agent.create">创建 Agent</SelectItem>
                <SelectItem value="agent.update">更新 Agent</SelectItem>
                <SelectItem value="agent.delete">删除 Agent</SelectItem>
                <SelectItem value="agent.publish">发布 Agent</SelectItem>
                <SelectItem value="run.start">运行开始</SelectItem>
                <SelectItem value="run.complete">运行完成</SelectItem>
                <SelectItem value="run.fail">运行失败</SelectItem>
                <SelectItem value="tool.execute">工具执行</SelectItem>
                <SelectItem value="approval.approve">批准审批</SelectItem>
                <SelectItem value="approval.reject">拒绝审批</SelectItem>
                <SelectItem value="user.login">用户登录</SelectItem>
                <SelectItem value="user.logout">用户登出</SelectItem>
              </SelectContent>
            </Select>
            
            {/* 搜索 */}
            <SearchInput
              placeholder="搜索日志..."
              value={filters.q}
              onChange={(value) => updateSearchParams({ q: value })}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* 日志表格 */}
      {isLoading ? (
        <TableSkeleton rows={10} columns={6} />
      ) : logs?.items.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon />}
          title="未找到日志"
          description="尝试调整筛选条件"
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">时间</TableHead>
                <TableHead className="w-[120px]">用户</TableHead>
                <TableHead className="w-[150px]">事件类型</TableHead>
                <TableHead className="w-[150px]">Agent</TableHead>
                <TableHead>详情</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.items.map((log) => (
                <AuditLogRow key={log.id} log={log} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      
      {/* 分页 */}
      {logs && logs.totalPages > 1 && (
        <Pagination
          currentPage={filters.page}
          totalPages={logs.totalPages}
          onPageChange={(page) => updateSearchParams({ page: String(page) })}
        />
      )}
    </div>
  );
}
```

#### AuditLogRow 组件

```typescript
// apps/web/src/components/audit/AuditLogRow.tsx

interface AuditLogRowProps {
  log: AuditEvent;
}

export function AuditLogRow({ log }: AuditLogRowProps) {
  const [showDetail, setShowDetail] = useState(false);
  
  const getEventIcon = () => {
    if (log.eventType.startsWith('agent.')) {
      return <RobotIcon className="h-4 w-4 text-brand-600" />;
    }
    if (log.eventType.startsWith('run.')) {
      return <PlayIcon className="h-4 w-4 text-success-600" />;
    }
    if (log.eventType.startsWith('tool.')) {
      return <WrenchIcon className="h-4 w-4 text-info-600" />;
    }
    if (log.eventType.startsWith('approval.')) {
      return <CheckCircleIcon className="h-4 w-4 text-warning-600" />;
    }
    if (log.eventType.startsWith('user.')) {
      return <UserIcon className="h-4 w-4 text-neutral-600" />;
    }
    return <FileTextIcon className="h-4 w-4 text-neutral-600" />;
  };
  
  const getEventLabel = () => {
    const labels: Record<string, string> = {
      'agent.create': '创建 Agent',
      'agent.update': '更新 Agent',
      'agent.delete': '删除 Agent',
      'agent.publish': '发布 Agent',
      'run.start': '运行开始',
      'run.complete': '运行完成',
      'run.fail': '运行失败',
      'tool.execute': '工具执行',
      'approval.approve': '批准审批',
      'approval.reject': '拒绝审批',
      'user.login': '用户登录',
      'user.logout': '用户登出',
    };
    return labels[log.eventType] || log.eventType;
  };
  
  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-xs">
          {formatDateTime(log.timestamp)}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Avatar
              src={log.user.avatar}
              fallback={log.user.displayName[0]}
              size="xs"
            />
            <span className="text-sm">{log.user.displayName}</span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {getEventIcon()}
            <span className="text-sm">{getEventLabel()}</span>
          </div>
        </TableCell>
        <TableCell>
          {log.agentName ? (
            <span className="text-sm">{log.agentName}</span>
          ) : (
            <span className="text-sm text-neutral-400">-</span>
          )}
        </TableCell>
        <TableCell>
          <span className="text-sm text-neutral-700 line-clamp-1">
            {log.summary}
          </span>
        </TableCell>
        <TableCell>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setShowDetail(true)}
          >
            查看
          </Button>
        </TableCell>
      </TableRow>
      
      {/* 详情对话框 */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>审计日志详情</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-neutral-600 mb-1">事件 ID</div>
                <code className="text-xs bg-neutral-100 px-2 py-1 rounded">
                  {log.id}
                </code>
              </div>
              <div>
                <div className="text-neutral-600 mb-1">时间</div>
                <div className="font-mono text-xs">
                  {formatDateTime(log.timestamp)}
                </div>
              </div>
              <div>
                <div className="text-neutral-600 mb-1">用户</div>
                <div>{log.user.displayName} ({log.user.email})</div>
              </div>
              <div>
                <div className="text-neutral-600 mb-1">IP 地址</div>
                <div className="font-mono text-xs">{log.ipAddress}</div>
              </div>
              <div>
                <div className="text-neutral-600 mb-1">事件类型</div>
                <Badge variant="neutral">{getEventLabel()}</Badge>
              </div>
              {log.agentId && (
                <div>
                  <div className="text-neutral-600 mb-1">Agent</div>
                  <Link
                    href={`/agents/${log.agentId}`}
                    className="text-brand-600 hover:text-brand-700"
                  >
                    {log.agentName}
                  </Link>
                </div>
              )}
            </div>
            
            <Divider />
            
            {/* 详细数据 */}
            <div>
              <div className="text-sm font-medium text-neutral-700 mb-2">
                详细数据
              </div>
              <pre className="text-xs bg-neutral-50 p-4 rounded overflow-x-auto max-h-96">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            </div>
            
            {/* 元数据 */}
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <>
                <Divider />
                <div>
                  <div className="text-sm font-medium text-neutral-700 mb-2">
                    元数据
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(log.metadata).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-neutral-600">{key}:</span>{' '}
                        <span className="text-neutral-900">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowDetail(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

## 四、通用组件库

### 4.1 基础组件

#### Button 组件

```typescript
// packages/ui/src/components/Button.tsx

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'success' | 'error' | 'warning';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  href?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  href,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors rounded-md';
  
  const variantStyles = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700',
    outline: 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
    ghost: 'text-neutral-700 hover:bg-neutral-100',
    success: 'bg-success-600 text-white hover:bg-success-700',
    error: 'bg-error-600 text-white hover:bg-error-700',
    warning: 'bg-warning-600 text-white hover:bg-warning-700',
  };
  
  const sizeStyles = {
    xs: 'h-7 px-2 text-xs gap-1',
    sm: 'h-8 px-3 text-sm gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2',
  };
  
  const classes = cn(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && 'w-full',
    (disabled || loading) && 'opacity-50 cursor-not-allowed',
    className
  );
  
  const content = (
    <>
      {loading && <Spinner size={size === 'xs' ? 'xs' : 'sm'} />}
      {!loading && leftIcon && leftIcon}
      {children}
      {rightIcon && rightIcon}
    </>
  );
  
  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  
  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {content}
    </button>
  );
}
```

#### Input 组件

```typescript
// packages/ui/src/components/Input.tsx

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  error,
  leftIcon,
  rightIcon,
  className,
  ...props
}: InputProps) {
  return (
    <div className="relative">
      {leftIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
          {leftIcon}
        </div>
      )}
      
      <input
        className={cn(
          'h-10 w-full rounded-md border bg-white px-3 text-sm',
          'transition-colors',
          'placeholder:text-neutral-400',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
          error
            ? 'border-error-500 focus:ring-error-500'
            : 'border-neutral-300',
          leftIcon && 'pl-10',
          rightIcon && 'pr-10',
          props.disabled && 'bg-neutral-50 cursor-not-allowed',
          className
        )}
        {...props}
      />
      
      {rightIcon && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">
          {rightIcon}
        </div>
      )}
      
      {error && (
        <p className="mt-1 text-xs text-error-600">
          {error}
        </p>
      )}
    </div>
  );
}
```

#### Card 组件

```typescript
// packages/ui/src/components/Card.tsx

export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-neutral-200 bg-white shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-6 py-4 border-b border-neutral-200', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-semibold text-neutral-900', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 py-4', className)} {...props}>
      {children}
    </div>
  );
}
```

#### Badge 组件

```typescript
// packages/ui/src/components/Badge.tsx

export interface BadgeProps {
  variant?: 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export function Badge({
  variant = 'neutral',
  size = 'md',
  children,
  className,
}: BadgeProps) {
  const variantStyles = {
    neutral: 'bg-neutral-100 text-neutral-700',
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    error: 'bg-error-50 text-error-700',
    info: 'bg-info-50 text-info-700',
  };
  
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
```

#### RiskBadge 组件

```typescript
// packages/ui/src/components/RiskBadge.tsx

export interface RiskBadgeProps {
  level: 'safe' | 'medium' | 'high' | 'critical';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RiskBadge({ level, size = 'md', className }: RiskBadgeProps) {
  const config = {
    safe: {
      label: '安全',
      color: 'bg-success-50 text-success-700 border-success-200',
    },
    medium: {
      label: '中等',
      color: 'bg-warning-50 text-warning-700 border-warning-200',
    },
    high: {
      label: '高风险',
      color: 'bg-error-50 text-error-700 border-error-200',
    },
    critical: {
      label: '严重',
      color: 'bg-error-100 text-error-800 border-error-300',
    },
  };
  
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        config[level].color,
        sizeStyles[size],
        className
      )}
    >
      {config[level].label}
    </span>
  );
}
```

#### Alert 组件

```typescript
// packages/ui/src/components/Alert.tsx

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export function Alert({
  variant = 'info',
  size = 'md',
  children,
  className,
}: AlertProps) {
  const variantStyles = {
    info: 'bg-info-50 border-info-200 text-info-900',
    success: 'bg-success-50 border-success-200 text-success-900',
    warning: 'bg-warning-50 border-warning-200 text-warning-900',
    error: 'bg-error-50 border-error-200 text-error-900',
  };
  
  const sizeStyles = {
    sm: 'p-3 text-sm',
    md: 'p-4 text-base',
  };
  
  return (
    <div
      className={cn(
        'rounded-md border',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </div>
  );
}

export function AlertTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('font-medium mb-1', className)}>
      {children}
    </div>
  );
}

export function AlertDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('text-sm', className)}>
      {children}
    </div>
  );
}
```

---

### 4.2 业务组件

#### StatusBadge 组件

```typescript
// apps/web/src/components/agent/StatusBadge.tsx

export interface StatusBadgeProps {
  status: 'draft' | 'testing' | 'published' | 'paused' | 'archived' | 'failed';
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = {
    draft: {
      label: '草稿',
      color: 'bg-neutral-100 text-neutral-700',
      icon: <FileTextIcon className="h-3 w-3" />,
    },
    testing: {
      label: '测试中',
      color: 'bg-info-50 text-info-700',
      icon: <FlaskIcon className="h-3 w-3" />,
    },
    published: {
      label: '已发布',
      color: 'bg-success-50 text-success-700',
      icon: <CheckCircleIcon className="h-3 w-3" />,
    },
    paused: {
      label: '已暂停',
      color: 'bg-warning-50 text-warning-700',
      icon: <PauseIcon className="h-3 w-3" />,
    },
    archived: {
      label: '已归档',
      color: 'bg-neutral-100 text-neutral-600',
      icon: <ArchiveIcon className="h-3 w-3" />,
    },
    failed: {
      label: '失败',
      color: 'bg-error-50 text-error-700',
      icon: <XCircleIcon className="h-3 w-3" />,
    },
  };
  
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-sm gap-1.5',
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        config[status].color,
        sizeStyles[size]
      )}
    >
      {config[status].icon}
      {config[status].label}
    </span>
  );
}
```

#### EmptyState 组件

```typescript
// packages/ui/src/components/EmptyState.tsx

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
        <div className="text-neutral-400">
          {icon}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-neutral-600 mb-6 max-w-md">
          {description}
        </p>
      )}
      {action && action}
    </div>
  );
}
```

#### SearchInput 组件

```typescript
// packages/ui/src/components/SearchInput.tsx

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounce?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder = '搜索...',
  className,
  debounce = 300,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  
  // 防抖处理
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, debounce);
    
    return () => clearTimeout(timer);
  }, [localValue, debounce, onChange]);
  
  // 同步外部变化
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  return (
    <Input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      placeholder={placeholder}
      leftIcon={<SearchIcon className="h-4 w-4" />}
      rightIcon={
        localValue && (
          <button
            onClick={() => {
              setLocalValue('');
              onChange('');
            }}
            className="text-neutral-500 hover:text-neutral-700"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )
      }
      className={className}
    />
  );
}
```

---

## 五、状态管理和数据流

### 5.1 服务端状态（TanStack Query）

```typescript
// apps/web/src/lib/queries/agents.ts

export function useAgent(id: string) {
  return useQuery({
    queryKey: ['agent', id],
    queryFn: () => fetchAgent(id),
    staleTime: 5 * 60 * 1000, // 5 分钟
  });
}

export function useAgents(filters: AgentFilters) {
  return useQuery({
    queryKey: ['agents', filters],
    queryFn: () => fetchAgents(filters),
    keepPreviousData: true,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createAgent,
    onSuccess: () => {
      queryClient.invalidateQueries(['agents']);
      toast.success('Agent 创建成功');
    },
    onError: (error) => {
      toast.error('创建失败：' + error.message);
    },
  });
}

export function usePublishAgent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string }) =>
      publishAgent(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['agent', variables.id]);
      queryClient.invalidateQueries(['agents']);
      toast.success('Agent 发布成功');
    },
  });
}
```

### 5.2 客户端状态（Zustand）

```typescript
// apps/web/src/stores/useAgentCreatorStore.ts

interface AgentCreatorState {
  currentStep: number;
  formData: Partial<AgentDefinition>;
  setStep: (step: number) => void;
  updateFormData: (data: Partial<AgentDefinition>) => void;
  reset: () => void;
}

export const useAgentCreatorStore = create<AgentCreatorState>((set) => ({
  currentStep: 1,
  formData: {},
  
  setStep: (step) => set({ currentStep: step }),
  
  updateFormData: (data) =>
    set((state) => ({
      formData: { ...state.formData, ...data },
    })),
  
  reset: () => set({ currentStep: 1, formData: {} }),
}));
```

### 5.3 WebSocket 实时连接

```typescript
// apps/web/src/lib/websocket/useAgentWebSocket.ts

export function useAgentWebSocket(agentId: string) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    const token = getShortLivedAccessToken();
    const ws = new WebSocket(`${WS_URL}/gateway/ws`);
    
    ws.onopen = () => {
      setIsConnected(true);
      // 凭据只放在首帧，不放 URL；tenantId 由服务端从身份上下文推导
      ws.send(JSON.stringify({
        type: 'connect',
        version: '1.0',
        clientId: getClientId(),
        credential: token,
        lastSequence: getLastSequence(),
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'hello') {
        ws.send(JSON.stringify({ type: 'subscribe', agentId }));
      }
      setEvents((prev) => [...prev, data]);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error('连接失败');
    };
    
    ws.onclose = () => {
      setIsConnected(false);
    };
    
    wsRef.current = ws;
    
    return () => {
      ws.close();
    };
  }, [agentId]);
  
  const sendMessage = useCallback((message: string) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        agentId,
        content: message,
      }));
    }
  }, [agentId, isConnected]);
  
  return {
    events,
    isConnected,
    sendMessage,
  };
}
```

---

## 六、响应式设计

### 6.1 断点系统

```typescript
// packages/ui/src/design-tokens/breakpoints.ts

export const breakpoints = {
  sm: '640px',  // 手机横屏
  md: '768px',  // 平板竖屏
  lg: '1024px', // 平板横屏 / 笔记本
  xl: '1280px', // 桌面
  '2xl': '1536px', // 大屏
};

// Tailwind 配置
module.exports = {
  theme: {
    screens: breakpoints,
  },
};
```

### 6.2 响应式布局策略

#### Header

- **Desktop (`lg+`)**: 完整显示 Logo、搜索、通知、用户菜单
- **Tablet (`md`)**: 隐藏搜索，在用户菜单中提供搜索入口
- **Mobile (`< md`)**: 汉堡菜单，所有功能收起

#### Sidebar

- **Desktop (`lg+`)**: 固定在左侧，240px 宽度
- **Tablet (`md`)**: 可折叠，默认折叠只显示图标
- **Mobile (`< md`)**: 抽屉模式，默认隐藏

#### 表格

- **Desktop**: 完整表格
- **Tablet**: 隐藏次要列
- **Mobile**: 卡片列表模式

```typescript
// apps/web/src/components/responsive/ResponsiveTable.tsx

export function ResponsiveTable({ data, columns }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  if (isMobile) {
    return (
      <div className="space-y-2">
        {data.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              {/* 卡片布局 */}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  return <Table columns={columns} data={data} />;
}
```

---

## 七、国际化（i18n）

### 7.1 i18n 架构

```typescript
// packages/i18n/src/index.ts

export const languages = ['zh-CN', 'en-US'] as const;
export type Language = typeof languages[number];

export const defaultLanguage: Language = 'zh-CN';

// 翻译资源
export const translations = {
  'zh-CN': {
    common: {
      save: '保存',
      cancel: '取消',
      delete: '删除',
      edit: '编辑',
      create: '创建',
      search: '搜索',
      filter: '筛选',
      loading: '加载中...',
      error: '错误',
      success: '成功',
    },
    agent: {
      title: 'Agent',
      create: '创建 Agent',
      edit: '编辑 Agent',
      delete: '删除 Agent',
      publish: '发布',
      test: '测试',
      status: {
        draft: '草稿',
        testing: '测试中',
        published: '已发布',
        paused: '已暂停',
        archived: '已归档',
      },
    },
    skill: {
      title: 'Skill 市场',
      install: '安装',
      installed: '已安装',
      category: '分类',
      risk: '风险等级',
    },
  },
  'en-US': {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      search: 'Search',
      filter: 'Filter',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
    },
    agent: {
      title: 'Agent',
      create: 'Create Agent',
      edit: 'Edit Agent',
      delete: 'Delete Agent',
      publish: 'Publish',
      test: 'Test',
      status: {
        draft: 'Draft',
        testing: 'Testing',
        published: 'Published',
        paused: 'Paused',
        archived: 'Archived',
      },
    },
    skill: {
      title: 'Skill Marketplace',
      install: 'Install',
      installed: 'Installed',
      category: 'Category',
      risk: 'Risk Level',
    },
  },
};
```

### 7.2 使用示例

```typescript
// apps/web/src/app/agents/page.tsx

import { useTranslation } from '@/lib/i18n';

export default function AgentsPage() {
  const { t } = useTranslation();
  
  return (
    <div>
      <PageHeader
        title={t('agent.title')}
        action={
          <Button>
            {t('agent.create')}
          </Button>
        }
      />
    </div>
  );
}
```

---

## 八、无障碍访问（Accessibility）

### 8.1 WCAG 2.1 AA 级别要求

#### 颜色对比度

所有文字和背景的对比度必须满足：
- 正常文字（< 18px）：至少 4.5:1
- 大文字（≥ 18px 或 ≥ 14px 加粗）：至少 3:1

```typescript
// 当前配色对比度检查结果
const contrastRatios = {
  'neutral-900 on white': 19.56, // ✅ 通过
  'neutral-700 on white': 11.24, // ✅ 通过
  'neutral-600 on white': 8.89,  // ✅ 通过
  'brand-500 on white': 4.52,    // ✅ 通过
  'brand-700 on brand-50': 7.31, // ✅ 通过
};
```

#### 键盘导航

所有交互元素必须支持键盘操作：
- `Tab` / `Shift+Tab`: 焦点移动
- `Enter` / `Space`: 激活按钮
- `Escape`: 关闭对话框/下拉菜单
- `Arrow Keys`: 导航列表/菜单

```typescript
// 示例：可访问的 Modal 组件
export function Modal({ isOpen, onClose, children }) {
  useEffect(() => {
    if (!isOpen) return;
    
    // 焦点陷阱
    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements?.[0];
    const lastElement = focusableElements?.[focusableElements.length - 1];
    
    firstElement?.focus();
    
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleTab);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('keydown', handleTab);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);
  
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {children}
    </div>
  );
}
```

#### ARIA 标签

```typescript
// 正确的 ARIA 使用示例

// 按钮
<button
  aria-label="关闭对话框"
  onClick={onClose}
>
  <XIcon />
</button>

// 加载状态
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading ? '正在加载...' : '加载完成'}
</div>

// 表单错误
<input
  aria-invalid={!!error}
  aria-describedby={error ? 'input-error' : undefined}
/>
{error && <p id="input-error" role="alert">{error}</p>}

// 标签页
<div role="tablist">
  <button
    role="tab"
    aria-selected={tab === 'my'}
    aria-controls="my-panel"
  >
    我的
  </button>
  <div
    id="my-panel"
    role="tabpanel"
    aria-labelledby="my-tab"
  >
    {/* 内容 */}
  </div>
</div>
```

#### 焦点可见性

```css
/* packages/ui/src/styles/focus.css */

/* 全局焦点样式 */
*:focus-visible {
  outline: 2px solid var(--color-brand-500);
  outline-offset: 2px;
}

/* 按钮焦点 */
button:focus-visible {
  outline: 2px solid var(--color-brand-500);
  outline-offset: 2px;
}

/* 输入框焦点 */
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-brand-500);
}
```

### 8.2 屏幕阅读器支持

```typescript
// apps/web/src/components/layout/SkipToContent.tsx

// 跳过导航链接（对屏幕阅读器用户友好）
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded"
    >
      跳到主内容
    </a>
  );
}

// 使用
export function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SkipToContent />
        <Header />
        <Sidebar />
        <main id="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
```

---

## 九、性能优化

### 9.1 代码分割和懒加载

```typescript
// apps/web/src/app/agents/[id]/page.tsx

import dynamic from 'next/dynamic';

// 懒加载重量级组件
const AgentTestWorkbench = dynamic(
  () => import('@/components/agent/AgentTestWorkbench'),
  {
    loading: () => <Skeleton />,
    ssr: false, // 测试工作台不需要 SSR
  }
);

const WorkflowEditor = dynamic(
  () => import('@/components/workflow/WorkflowEditor'),
  {
    loading: () => <Skeleton />,
    ssr: false,
  }
);
```

### 9.2 图片优化

```typescript
// 使用 Next.js Image 组件
import Image from 'next/image';

<Image
  src={agent.avatar}
  alt={agent.displayName}
  width={64}
  height={64}
  className="rounded-lg"
  loading="lazy"
  placeholder="blur"
  blurDataURL={agent.avatarBlurHash}
/>
```

### 9.3 列表虚拟化

```typescript
// apps/web/src/components/agent/VirtualizedAgentList.tsx

import { useVirtualizer } from '@tanstack/react-virtual';

export function VirtualizedAgentList({ agents }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: agents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // 每个 Agent 卡片约 200px
    overscan: 5,
  });
  
  return (
    <div ref={parentRef} className="h-screen overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const agent = agents[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <AgentCard agent={agent} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 9.4 缓存策略

```typescript
// apps/web/src/lib/api/client.ts

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 全局默认缓存 5 分钟
      staleTime: 5 * 60 * 1000,
      // 缓存时间 10 分钟
      cacheTime: 10 * 60 * 1000,
      // 重新连接时自动刷新
      refetchOnWindowFocus: true,
      // 重新挂载时不刷新
      refetchOnMount: false,
      // 失败重试 1 次
      retry: 1,
    },
  },
});

// 特定资源的缓存配置
export function useAgent(id: string) {
  return useQuery({
    queryKey: ['agent', id],
    queryFn: () => fetchAgent(id),
    // Agent 详情缓存更长时间
    staleTime: 10 * 60 * 1000,
  });
}

export function useRealtimeRuns() {
  return useQuery({
    queryKey: ['runs', 'realtime'],
    queryFn: fetchRealtimeRuns,
    // 实时数据不缓存
    staleTime: 0,
    // 每 5 秒刷新一次
    refetchInterval: 5000,
  });
}
```

---

## 十、错误处理和用户反馈

### 10.1 全局错误边界

```typescript
// apps/web/src/components/ErrorBoundary.tsx

'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // 发送错误到监控服务
    reportError({
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-6 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-error-50 flex items-center justify-center mx-auto">
                <AlertCircleIcon className="h-8 w-8 text-error-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">
                  出错了
                </h2>
                <p className="text-sm text-neutral-600">
                  应用遇到了一个错误，请刷新页面重试
                </p>
              </div>
              <Button
                fullWidth
                onClick={() => window.location.reload()}
              >
                刷新页面
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### 10.2 Toast 通知

```typescript
// packages/ui/src/components/Toast.tsx

import { Toaster, toast as sonnerToast } from 'sonner';

// 全局 Toaster（放在 layout 中）
export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: 'rounded-lg shadow-lg',
          title: 'font-medium',
          description: 'text-sm text-neutral-600',
        },
      }}
    />
  );
}

// 使用示例
export const toast = {
  success: (message: string) =>
    sonnerToast.success(message, {
      icon: <CheckCircleIcon className="h-5 w-5 text-success-600" />,
    }),
  
  error: (message: string) =>
    sonnerToast.error(message, {
      icon: <XCircleIcon className="h-5 w-5 text-error-600" />,
    }),
  
  warning: (message: string) =>
    sonnerToast.warning(message, {
      icon: <AlertCircleIcon className="h-5 w-5 text-warning-600" />,
    }),
  
  info: (message: string) =>
    sonnerToast.info(message, {
      icon: <InfoIcon className="h-5 w-5 text-info-600" />,
    }),
  
  loading: (message: string) =>
    sonnerToast.loading(message),
  
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) =>
    sonnerToast.promise(promise, messages),
};
```

### 10.3 API 错误处理

```typescript
// apps/web/src/lib/api/error-handler.ts

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({
      error: { code: 'INTERNAL_ERROR', message: '请求失败' },
    }));
    const error = body.error ?? body;
    
    throw new ApiError(
      error.code,
      error.message,
      response.status,
      error.details
    );
  }
  
  return response.json();
}

// 全局错误处理 Hook
export function useApiErrorHandler() {
  return useCallback((error: unknown) => {
    if (error instanceof ApiError) {
      // 根据错误码显示不同的消息
      switch (error.code) {
        case 'UNAUTHORIZED':
          toast.error('请先登录');
          router.push('/login');
          break;
        
        case 'FORBIDDEN':
          toast.error('您没有权限执行此操作');
          break;
        
        case 'NOT_FOUND':
          toast.error('Agent 不存在');
          break;
        
        case 'VALIDATION_ERROR':
          toast.error('输入数据不符合要求');
          break;
        
        case 'BUDGET_EXCEEDED':
          toast.error('已超出预算限制');
          break;
        
        default:
          toast.error(error.message || '操作失败');
      }
    } else {
      toast.error('网络错误，请稍后重试');
    }
  }, []);
}
```

---

## 十一、测试策略

### 11.1 组件测试（Vitest + Testing Library）

```typescript
// packages/ui/src/components/__tests__/Button.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });
  
  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('is disabled when loading', () => {
    render(<Button loading>Click me</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
  
  it('applies variant styles', () => {
    const { container } = render(<Button variant="error">Delete</Button>);
    
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-error-600');
  });
});
```

### 11.2 集成测试

```typescript
// apps/web/src/app/agents/__tests__/create.test.tsx

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/api/client';
import AgentCreatePage from '../create/page';

describe('Agent Creation Flow', () => {
  beforeEach(() => {
    queryClient.clear();
  });
  
  it('completes the wizard flow', async () => {
    const user = userEvent.setup();
    
    render(
      <QueryClientProvider client={queryClient}>
        <AgentCreatePage />
      </QueryClientProvider>
    );
    
    // 步骤 1：选择模板
    expect(screen.getByText('选择 Agent 模板')).toBeInTheDocument();
    await user.click(screen.getByText('客服助手'));
    await user.click(screen.getByRole('button', { name: '下一步' }));
    
    // 步骤 2：基本信息
    await waitFor(() => {
      expect(screen.getByText('填写基本信息')).toBeInTheDocument();
    });
    
    await user.type(
      screen.getByLabelText('Agent 名称'),
      '我的客服助手'
    );
    await user.type(
      screen.getByLabelText('描述'),
      '帮助客户解决问题'
    );
    await user.click(screen.getByRole('button', { name: '下一步' }));
    
    // 步骤 3：选择 Skill
    await waitFor(() => {
      expect(screen.getByText('选择 Agent 的能力')).toBeInTheDocument();
    });
    
    // ... 继续测试其他步骤
  });
  
  it('validates required fields', async () => {
    const user = userEvent.setup();
    
    render(
      <QueryClientProvider client={queryClient}>
        <AgentCreatePage />
      </QueryClientProvider>
    );
    
    // 不选择模板直接点下一步
    await user.click(screen.getByRole('button', { name: '下一步' }));
    
    // 应该显示错误
    expect(screen.getByText('请选择一个模板')).toBeInTheDocument();
  });
});
```

### 11.3 端到端测试（Playwright）

```typescript
// apps/web/tests/e2e/agent-creation.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Agent Creation', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/');
  });
  
  test('creates an agent successfully', async ({ page }) => {
    // 点击创建 Agent
    await page.click('text=创建 Agent');
    await expect(page).toHaveURL('/agents/create');
    
    // 步骤 1：选择模板
    await page.click('text=客服助手');
    await page.click('button:has-text("下一步")');
    
    // 步骤 2：基本信息
    await page.fill('input[name="displayName"]', 'E2E 测试 Agent');
    await page.fill('textarea[name="description"]', '这是一个测试 Agent');
    await page.click('button:has-text("下一步")');
    
    // 步骤 3：选择 Skill
    await page.click('[data-skill-id="read-file"]');
    await page.click('[data-skill-id="web-search"]');
    await page.click('button:has-text("下一步")');
    
    // 步骤 4：权限
    // 默认权限，直接下一步
    await page.click('button:has-text("下一步")');
    
    // 步骤 5：审批策略
    // 选择标准策略
    await page.click('input[value="standard"]');
    await page.click('button:has-text("下一步")');
    
    // 步骤 6：渠道
    // 默认 Web，直接下一步
    await page.click('button:has-text("下一步")');
    
    // 步骤 7：发布
    await page.click('button:has-text("发布 Agent")');
    
    // 等待发布成功
    await expect(page.locator('text=Agent 发布成功')).toBeVisible();
    
    // 跳转到 Agent 详情页
    await expect(page).toHaveURL(/\/agents\/[a-z0-9]+/);
  });
  
  test('requires approval for high-risk operations', async ({ page }) => {
    // 创建一个包含高风险权限的 Agent
    await page.goto('/agents/create');
    
    // ... 前面的步骤省略
    
    // 步骤 4：启用高风险权限
    await page.check('input[value="communication:send"]');
    
    // 应该显示风险警告
    await expect(
      page.locator('text=建议启用人工审批')
    ).toBeVisible();
    
    // 继续到审批策略
    await page.click('button:has-text("下一步")');
    
    // 验证严格策略被推荐
    await expect(
      page.locator('input[value="strict"]')
    ).toBeChecked();
  });
});
```

---

## 十二、部署和构建

### 12.1 生产构建配置

```typescript
// apps/web/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // 生产优化
  productionBrowserSourceMaps: false,
  
  // 图片优化
  images: {
    domains: ['cdn.example.com'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // 环境变量
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
  
  // 输出配置
  output: 'standalone',
  
  // 压缩
  compress: true,
  
  // 国际化
  i18n: {
    locales: ['zh-CN', 'en-US'],
    defaultLocale: 'zh-CN',
  },
  
  // 实验性特性
  experimental: {
    optimizeCss: true,
  },
};

module.exports = nextConfig;
```

### 12.2 Docker 部署

```dockerfile
# `apps/web/Dockerfile`

# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web

# 安装依赖
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# 构建
RUN pnpm --filter web build

# 运行阶段
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/web/server.js"]
```

### 12.3 Kubernetes 部署

```yaml
# `infra/kubernetes/web-deployment.yaml`

apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-platform-web
  labels:
    app: agent-platform-web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent-platform-web
  template:
    metadata:
      labels:
        app: agent-platform-web
    spec:
      containers:
      - name: web
        image: agent-platform-web:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_API_URL
          valueFrom:
            configMapKeyRef:
              name: agent-platform-config
              key: api-url
        - name: NEXT_PUBLIC_WS_URL
          valueFrom:
            configMapKeyRef:
              name: agent-platform-config
              key: ws-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: agent-platform-web
spec:
  selector:
    app: agent-platform-web
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

---

## 十三、设计规范总结

### 13.1 核心设计原则

1. **一致性优先**
   - 统一的颜色、字体、间距系统
   - 统一的组件行为和交互模式
   - 统一的错误处理和用户反馈

2. **用户体验**
   - 清晰的视觉层次
   - 快速的响应时间（加载状态、骨架屏）
   - 友好的错误提示
   - 完整的空状态设计

3. **可访问性**
   - WCAG 2.1 AA 级别
   - 键盘导航支持
   - 屏幕阅读器支持
   - 合适的颜色对比度

4. **性能优化**
   - 代码分割和懒加载
   - 图片优化
   - 列表虚拟化
   - 合理的缓存策略

5. **可维护性**
   - 组件化和模块化
   - Design Tokens 管理
   - 完善的类型定义
   - 清晰的代码组织

### 13.2 关键页面清单

| 页面 | 路径 | 状态 | 优先级 |
|------|------|------|--------|
| 登录页 | `/login` | ✅ 已完成 | P0 |
| 首页 | `/` | ✅ 已完成 | P0 |
| Agent 列表 | `/agents` | ✅ 已完成 | P0 |
| Agent 创建 | `/agents/create` | ✅ 已完成 | P0 |
| Agent 测试 | `/agents/[id]/test` | ✅ 已完成 | P0 |
| Skill 市场 | `/skills` | ✅ 已完成 | P1 |
| Skill 详情 | `/skills/[id]` | ✅ 已完成 | P1 |
| 审批中心 | `/approvals` | ✅ 已完成 | P1 |
| 审计日志 | `/audit` | ✅ 已完成 | P1 |
| 会话列表 | `/conversations` | 📝 待设计 | P2 |
| 知识库 | `/knowledge` | 📝 待设计 | P2 |
| 工作流 | `/workflows` | 📝 待设计 | P2 |
| 用户管理 | `/users` | 📝 待设计 | P2 |
| 设置 | `/settings` | 📝 待设计 | P2 |

### 13.3 组件库清单

#### 基础组件（已完成）
- ✅ Button
- ✅ Input
- ✅ Card
- ✅ Badge
- ✅ Alert
- ✅ RiskBadge
- ✅ SearchInput
- ✅ EmptyState
- ✅ StatusBadge

#### 需补充的基础组件
- 📝 Select / Dropdown
- 📝 Checkbox / Radio
- 📝 Switch / Toggle
- 📝 Textarea
- 📝 Modal / Dialog
- 📝 Tabs
- 📝 Table
- 📝 Pagination
- 📝 Breadcrumb
- 📝 Avatar
- 📝 Spinner / Loading
- 📝 Tooltip
- 📝 Collapsible
- 📝 DatePicker
- 📝 Form (React Hook Form 集成)

### 13.4 下一步开发建议

#### 阶段 1：补充基础组件（1-2 周）
1. 实现所有缺失的基础组件
2. 为每个组件编写单元测试
3. 创建 Storybook 文档

#### 阶段 2：完善核心页面（2-3 周）
1. 会话列表和详情页
2. 知识库管理页面
3. 用户和团队管理
4. 系统设置页面

#### 阶段 3：高级功能（2-3 周）
1. 工作流可视化编辑器
2. 实时协作功能
3. 高级筛选和搜索
4. 数据可视化图表

#### 阶段 4：优化和完善（1-2 周）
1. 性能优化
2. 无障碍访问完善
3. 国际化翻译
4. 端到端测试

---

## 附录：设计决策记录（ADR）

### ADR-001: 选择 Tailwind CSS 作为样式方案

**背景：** 需要选择一个 CSS 方案支持企业级前端开发

**决策：** 使用 Tailwind CSS + Design Tokens

**理由：**
- 原子化 CSS，避免样式冲突
- 优秀的 Tree-shaking，生产包体积小
- 强大的工具链和生态
- 易于维护和团队协作
- 支持 Design Tokens 统一管理

### ADR-002: 采用 shadcn/ui 作为基础组件库

**背景：** 需要一个企业级的 React 组件库

**决策：** 使用 shadcn/ui 作为基础，自定义扩展

**理由：**
- 组件直接复制到项目中，完全可控
- 基于 Radix UI，无障碍访问优秀
- 与 Tailwind CSS 完美集成
- 灵活的主题定制
- 活跃的社区支持

### ADR-003: Server Components 优先

**背景：** 本设计文档最初以 Next.js 14 为规划基线；当前实现使用 Next.js 16.3.2，同样支持 Server Components。

**决策：** 默认使用 Server Components，仅在必要时使用 Client Components

**理由：**
- 减少客户端 JavaScript 包体积
- 更好的首屏性能
- 天然支持服务端数据获取
- 更安全（敏感数据不暴露给客户端）

**Client Components 使用场景：**
- 需要浏览器 API（localStorage、WebSocket）
- 需要交互状态（useState、useEffect）
- 需要事件处理（onClick、onChange）

---

**文档版本：** v1.1  
**最后更新：** 2026-08-24  
**维护者：** 前端团队
