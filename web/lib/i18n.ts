// 国际化配置
export type Language = 'en' | 'zh' | 'ja';

export interface Translations {
  // Header
  appName: string;
  overview: string;
  agents: string;
  workflows: string;
  createAgent: string;
  notifications: string;

  // Hero Section
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  getStarted: string;
  viewDocumentation: string;
  allSystemsOperational: string;

  // Stats
  activeAgents: string;
  totalRuns: string;
  successRate: string;
  avgResponse: string;
  deployedThisWeek: string;
  inLastHour: string;
  aboveTarget: string;
  fasterThanLastWeek: string;

  // Recent Activity
  recentActivity: string;
  viewAll: string;
  completedAnalysis: string;
  processingRequest: string;
  sentEmails: string;
  compiledReport: string;
  minutesAgo: string;
  hourAgo: string;
  hoursAgo: string;

  // Agents Page
  yourAgents: string;
  manageAgents: string;
  active: string;
  paused: string;
  totalRunsLabel: string;
  configure: string;
  viewLogs: string;

  // Workflows Page
  noWorkflows: string;
  noWorkflowsDescription: string;
  createWorkflow: string;

  // Tools
  tools: string;
  knowledge: string;
  settings: string;
  runs: string;
  approvals: string;
  audit: string;
  costs: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    appName: 'Agent Platform',
    overview: 'Overview',
    agents: 'Agents',
    workflows: 'Workflows',
    createAgent: 'Create Agent',
    notifications: 'Notifications',

    heroTitle: 'Build intelligent agents',
    heroSubtitle: 'in minutes',
    heroDescription: 'Create, deploy, and manage AI agents with our powerful platform.',
    getStarted: 'Get Started',
    viewDocumentation: 'View Documentation',
    allSystemsOperational: 'All systems operational',

    activeAgents: 'Active Agents',
    totalRuns: 'Total Runs',
    successRate: 'Success Rate',
    avgResponse: 'Avg Response',
    deployedThisWeek: 'deployed this week',
    inLastHour: 'in the last hour',
    aboveTarget: 'Above target',
    fasterThanLastWeek: 'Faster than last week',

    recentActivity: 'Recent Activity',
    viewAll: 'View all',
    completedAnalysis: 'Completed analysis',
    processingRequest: 'Processing request',
    sentEmails: 'Sent emails',
    compiledReport: 'Compiled report',
    minutesAgo: 'minutes ago',
    hourAgo: 'hour ago',
    hoursAgo: 'hours ago',

    yourAgents: 'Your Agents',
    manageAgents: 'Manage and monitor all your AI agents in one place',
    active: 'active',
    paused: 'paused',
    totalRunsLabel: 'Total runs',
    configure: 'Configure',
    viewLogs: 'View Logs',

    noWorkflows: 'No workflows yet',
    noWorkflowsDescription: 'Get started by creating your first automated workflow',
    createWorkflow: 'Create Workflow',

    tools: 'Tools',
    knowledge: 'Knowledge',
    settings: 'Settings',
    runs: 'Runs',
    approvals: 'Approvals',
    audit: 'Audit',
    costs: 'Costs',
  },
  zh: {
    appName: 'Agent 平台',
    overview: '概览',
    agents: '智能体',
    workflows: '工作流',
    createAgent: '创建智能体',
    notifications: '通知',

    heroTitle: '快速构建智能体',
    heroSubtitle: '仅需几分钟',
    heroDescription: '使用我们强大的平台创建、部署和管理 AI 智能体。',
    getStarted: '开始使用',
    viewDocumentation: '查看文档',
    allSystemsOperational: '所有系统运行正常',

    activeAgents: '活跃智能体',
    totalRuns: '总运行次数',
    successRate: '成功率',
    avgResponse: '平均响应',
    deployedThisWeek: '本周部署',
    inLastHour: '最近一小时',
    aboveTarget: '超过目标',
    fasterThanLastWeek: '比上周更快',

    recentActivity: '近期活动',
    viewAll: '查看全部',
    completedAnalysis: '完成分析',
    processingRequest: '处理请求中',
    sentEmails: '发送邮件',
    compiledReport: '编译报告',
    minutesAgo: '分钟前',
    hourAgo: '小时前',
    hoursAgo: '小时前',

    yourAgents: '你的智能体',
    manageAgents: '在一个地方管理和监控所有 AI 智能体',
    active: '活跃',
    paused: '暂停',
    totalRunsLabel: '总运行次数',
    configure: '配置',
    viewLogs: '查看日志',

    noWorkflows: '还没有工作流',
    noWorkflowsDescription: '创建你的第一个自动化工作流',
    createWorkflow: '创建工作流',

    tools: '工具',
    knowledge: '知识库',
    settings: '设置',
    runs: '运行记录',
    approvals: '审批',
    audit: '审计',
    costs: '成本',
  },
  ja: {
    appName: 'エージェントプラットフォーム',
    overview: '概要',
    agents: 'エージェント',
    workflows: 'ワークフロー',
    createAgent: 'エージェント作成',
    notifications: '通知',

    heroTitle: 'インテリジェントエージェントを構築',
    heroSubtitle: '数分で',
    heroDescription: '強力なプラットフォームでAIエージェントを作成、デプロイ、管理します。',
    getStarted: '始める',
    viewDocumentation: 'ドキュメントを見る',
    allSystemsOperational: 'すべてのシステムが稼働中',

    activeAgents: 'アクティブエージェント',
    totalRuns: '総実行回数',
    successRate: '成功率',
    avgResponse: '平均応答',
    deployedThisWeek: '今週デプロイ',
    inLastHour: '過去1時間',
    aboveTarget: '目標を上回る',
    fasterThanLastWeek: '先週より高速',

    recentActivity: '最近のアクティビティ',
    viewAll: 'すべて表示',
    completedAnalysis: '分析完了',
    processingRequest: 'リクエスト処理中',
    sentEmails: 'メール送信完了',
    compiledReport: 'レポート作成完了',
    minutesAgo: '分前',
    hourAgo: '時間前',
    hoursAgo: '時間前',

    yourAgents: 'エージェント一覧',
    manageAgents: 'すべてのAIエージェントを一元管理・監視',
    active: 'アクティブ',
    paused: '一時停止',
    totalRunsLabel: '総実行回数',
    configure: '設定',
    viewLogs: 'ログを見る',

    noWorkflows: 'ワークフローがありません',
    noWorkflowsDescription: '最初の自動ワークフローを作成しましょう',
    createWorkflow: 'ワークフローを作成',

    tools: 'ツール',
    knowledge: 'ナレッジ',
    settings: '設定',
    runs: '実行履歴',
    approvals: '承認',
    audit: '監査',
    costs: 'コスト',
  },
};

export function getTranslation(lang: Language): Translations {
  return translations[lang];
}
