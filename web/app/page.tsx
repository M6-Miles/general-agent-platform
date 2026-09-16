'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Bot, CheckCircle2, Code2, FileText, Gauge, Timer, Workflow, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from './components/AuthProvider';
import { Language } from '../lib/i18n';
import { apiBaseUrl, apiRequest } from '../lib/api';
import { can } from '../lib/permissions';
import PlatformHeader from './components/PlatformHeader';
import ErrorState from './components/ErrorState';
import '../app/design-system.css';

type AgentSummary = { id: string; status: string };
type RunSummary = { status: string; created_at?: string; started_at?: string; finished_at?: string };

type DashboardStats = {
  totalAgents: number;
  activeAgents: number;
  totalRuns: number;
  recentRuns: number;
  successRate: number;
  avgResponseTime: number;
  agentsChange: number;
  runsChange: number;
};

export default function HomePage() {
  const router = useRouter();
  const { token, user, ready } = useAuth();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang && ['en', 'zh', 'ja'].includes(savedLang)) {
      setLanguage(savedLang);
    }
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    void loadDashboardStats();
  }, [ready, token, router]);

  const loadDashboardStats = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [agentsResult, runsResult] = await Promise.all([
        apiRequest<AgentSummary[]>(apiBaseUrl, '/api/v1/agents', token),
        apiRequest<RunSummary[]>(apiBaseUrl, '/api/v1/runs', token),
      ]);

      const agents = agentsResult.data || [];
      const runs = runsResult.data || [];

      // 计算统计数据
      const activeAgents = agents.filter(a => a.status === 'published' || a.status === 'active').length;
      const totalRuns = runs.length;
      const recentRuns = runs.filter(r => {
        const timeField = r.created_at || r.started_at;
        if (!timeField) return false;
        const runTime = new Date(timeField);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return runTime > oneHourAgo;
      }).length;

      const successfulRuns = runs.filter(r => r.status === 'success' || r.status === 'completed').length;
      const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;

      // 计算平均响应时间（秒）
      const completedRuns = runs.filter(r => r.started_at && r.finished_at);
      const avgResponseTime = completedRuns.length > 0
        ? completedRuns.reduce((sum, r) => {
            const start = new Date(r.started_at ?? '').getTime();
            const end = new Date(r.finished_at ?? '').getTime();
            return sum + (end - start) / 1000;
          }, 0) / completedRuns.length
        : 0;

      setStats({
        totalAgents: agents.length,
        activeAgents,
        totalRuns,
        recentRuns,
        successRate,
        avgResponseTime,
        agentsChange: 0, // 需要历史数据计算
        runsChange: 0,   // 需要历史数据计算
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      setStats(null);
      setError(error instanceof Error ? error.message : '概览数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  // 构建统计卡片数据
  const statsCards = stats ? [
    {
      icon: <Bot aria-hidden="true" size={24} strokeWidth={1.8} />,
      label: language === 'zh' ? '活跃 Agent' : 'Active Agents',
      value: stats.activeAgents.toString(),
      change: stats.agentsChange > 0 ? `+${stats.agentsChange}%` : `${stats.agentsChange}%`,
      changeType: stats.agentsChange >= 0 ? 'up' as const : 'down' as const,
      detail: language === 'zh' ? `总共 ${stats.totalAgents} 个` : `${stats.totalAgents} total`,
      color: 'blue' as const,
    },
    {
      icon: <Zap aria-hidden="true" size={24} strokeWidth={1.8} />,
      label: language === 'zh' ? '总执行次数' : 'Total Runs',
      value: stats.totalRuns.toLocaleString(),
      change: stats.runsChange > 0 ? `+${stats.runsChange}%` : `${stats.runsChange}%`,
      changeType: stats.runsChange >= 0 ? 'up' as const : 'down' as const,
      detail: language === 'zh' ? `${stats.recentRuns} 最近一小时` : `${stats.recentRuns} in last hour`,
      color: 'green' as const,
    },
    {
      icon: <CheckCircle2 aria-hidden="true" size={24} strokeWidth={1.8} />,
      label: language === 'zh' ? '成功率' : 'Success Rate',
      value: `${stats.successRate.toFixed(1)}%`,
      change: '+0%',
      changeType: 'up' as const,
      detail: stats.successRate >= 95
        ? (language === 'zh' ? '超出目标' : 'Above target')
        : (language === 'zh' ? '需要改进' : 'Needs improvement'),
      color: 'purple' as const,
    },
    {
      icon: <Timer aria-hidden="true" size={24} strokeWidth={1.8} />,
      label: language === 'zh' ? '平均响应' : 'Avg Response',
      value: `${stats.avgResponseTime.toFixed(1)}s`,
      change: '-0%',
      changeType: 'down' as const,
      detail: language === 'zh' ? '响应时间' : 'Response time',
      color: 'orange' as const,
    },
  ] : [];

  return (
    <div>
      {/* Header - 概览页只显示通知和用户设置 */}
      <PlatformHeader
        language={language}
        onLanguageChange={handleLanguageChange}
        activePage="home"
      />

      {/* Main Content */}
      <main className="platform-container">
        {/* Hero Section */}
        <div className="page-header">
          <div className="status-badge">
            <span className="status-dot"></span>
            {language === 'zh' ? '所有系统运行正常' : language === 'en' ? 'All systems operational' : 'すべてのシステムが稼働中'}
          </div>

          <h1 className="page-title">
            {language === 'zh' ? (
              <>可审计的<br /><span className="gradient">Agent Runtime</span></>
            ) : language === 'en' ? (
              <>Auditable<br /><span className="gradient">Agent Runtime</span></>
            ) : (
              <>監査可能な<br /><span className="gradient">Agent Runtime</span></>
            )}
          </h1>

          <p className="page-subtitle">
            {language === 'zh'
              ? '企业级多租户 Agent 管理平台。支持工具调用、工作流编排、全链路审计和实时监控。'
              : language === 'en'
              ? 'Enterprise-grade multi-tenant Agent management platform. Supports tool calling, workflow orchestration, full audit trail and real-time monitoring.'
              : 'エンタープライズグレードのマルチテナントエージェント管理プラットフォーム。ツール呼び出し、ワークフローオーケストレーション、完全な監査証跡、リアルタイム監視をサポート。'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          {loading ? (
            <div style={{ gridColumn: '1 / -1' }}><ErrorState state="loading" loadingMessage={language === 'zh' ? '加载统计数据...' : 'Loading stats...'} /></div>
          ) : error ? (
            <div style={{ gridColumn: '1 / -1' }}><ErrorState state="error" error={language === 'zh' ? `概览数据加载失败：${error}` : error} onRetry={() => void loadDashboardStats()} /></div>
          ) : (
            statsCards.map((stat, index) => (
              <div key={index} className="stat-card">
                <div className={`stat-icon ${stat.color}`}>
                  {stat.icon}
                </div>
                <div className="stat-label">{stat.label}</div>
                <div className="stat-value">
                  {stat.value}
                  {stat.change !== '0%' && (
                    <span className={`stat-change ${stat.changeType}`}>
                      {stat.change}
                    </span>
                  )}
                </div>
                <div className="stat-detail">{stat.detail}</div>
              </div>
            ))
          )}
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          {ready && can(user?.role, 'agent:write') && <Link className="btn btn-primary btn-large" href="/agents/create">
            <span>{language === 'zh' ? '创建 Agent' : language === 'en' ? 'Create Agent' : 'エージェント作成'}</span>
            <ArrowRight aria-hidden="true" size={20} />
          </Link>}
          <Link className="btn btn-secondary btn-large" href="/workflows/create">
            <Workflow aria-hidden="true" size={18} />
            {language === 'zh' ? '创建工作流' : language === 'en' ? 'Create Workflow' : 'ワークフロー作成'}
          </Link>
          <Link className="btn btn-secondary btn-large" href="/docs#agents">
            <BookOpen aria-hidden="true" size={18} />
            {language === 'zh' ? '核心概念' : language === 'en' ? 'Core Concepts' : 'コアコンセプト'}
          </Link>
          <Link className="btn btn-secondary btn-large" href="/docs#rest-api">
            <Code2 aria-hidden="true" size={18} />
            {language === 'zh' ? 'API 参考' : language === 'en' ? 'API Reference' : 'APIリファレンス'}
          </Link>
          <Link className="btn btn-secondary btn-large" href="/docs">
            <FileText aria-hidden="true" size={18} />
            {language === 'zh' ? '查看文档' : language === 'en' ? 'View Docs' : 'ドキュメント'}
          </Link>
        </div>
      </main>
    </div>
  );
}
