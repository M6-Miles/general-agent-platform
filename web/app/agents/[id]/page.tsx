'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { Language } from '../../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../../lib/api';
import PlatformHeader from '../../components/PlatformHeader';
import { useConfirm, useNotifier } from '../../components/NotificationProvider';
import ErrorState from '../../components/ErrorState';
import { errorMessage } from '../../../lib/errors';
import '../../design-system.css';

type Agent = {
  id: string;
  name: string;
  status: string;
  version: number;
  definition: {
    description?: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    tools?: Array<{ name: string }>;
    workflow?: { nodes?: unknown[]; edges?: unknown[] } | Array<Record<string, unknown>>;
  };
  created_at: string;
  updated_at: string;
};

type AgentVersion = {
  id: string;
  version: number;
  published_at: string;
};

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { token } = useAuth();
  const notify = useNotifier();
  const confirm = useConfirm();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [agent, setAgent] = React.useState<Agent | null>(null);
  const [versions, setVersions] = React.useState<AgentVersion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [publishing, setPublishing] = React.useState(false);
  const [agentId, setAgentId] = React.useState<string | null>(null);
  const workflow = agent?.definition.workflow && !Array.isArray(agent.definition.workflow)
    ? agent.definition.workflow
    : null;

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  React.useEffect(() => {
    params.then(p => setAgentId(p.id));
  }, [params]);

  React.useEffect(() => {
    if (!token || !agentId) {
      if (!token) router.push('/login');
      return;
    }
    loadAgent();
    loadVersions();
  }, [token, agentId]);

  const loadAgent = async () => {
    if (!token || !agentId) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<Agent>(apiBaseUrl, `/api/v1/agents/${agentId}`, token);
      setAgent(result.data);
    } catch (error) {
      console.error('Failed to load agent:', error);
      setAgent(null);
      setError(errorMessage(error, language === 'zh' ? '加载 Agent 失败' : 'Failed to load agent'));
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    if (!token || !agentId) return;
    try {
      const result = await apiRequest<AgentVersion[]>(
        apiBaseUrl,
        `/api/v1/agents/${agentId}/versions`,
        token
      );
      setVersions(result.data || []);
    } catch (error) {
      console.error('Failed to load versions:', error);
      setVersions([]);
    }
  };

  const handlePublish = async () => {
    if (!token || !agent) return;

    const confirmed = await confirm(
      language === 'zh'
        ? `确定要发布 Agent "${agent.name}" 的当前版本吗？`
        : `Publish current version of "${agent.name}"?`,
      language === 'zh' ? '发布 Agent' : 'Publish Agent'
    );
    if (!confirmed) return;

    setPublishing(true);
    try {
      await apiRequest(apiBaseUrl, `/api/v1/agents/${agentId}/publish`, token, {
        method: 'POST'
      });
      notify(language === 'zh' ? '发布成功' : 'Published successfully', 'success');
      void loadAgent();
      void loadVersions();
    } catch (error) {
      console.error('Failed to publish:', error);
      notify(language === 'zh' ? '发布失败' : 'Failed to publish', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  if (loading) {
    return (
      <div>
        <PlatformHeader
          language={language}
          onLanguageChange={handleLanguageChange}
          activePage="agents"
        />
        <main className="platform-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>{language === 'zh' ? '加载中...' : 'Loading...'}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error && !agent) {
    return (
      <div>
        <PlatformHeader
          language={language}
          onLanguageChange={handleLanguageChange}
          activePage="agents"
        />
        <main className="platform-container">
          <ErrorState state="error" error={error} onRetry={() => void loadAgent()} />
          <button className="btn btn-secondary" onClick={() => router.push('/agents')}>
            {language === 'zh' ? '返回列表' : 'Back to List'}
          </button>
        </main>
      </div>
    );
  }

  if (!agent) {
    return <div><PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="agents" /><main className="platform-container"><ErrorState state="empty" emptyTitle={language === 'zh' ? 'Agent 不存在' : 'Agent Not Found'} emptyAction={<button className="btn btn-primary" onClick={() => router.push('/agents')}>{language === 'zh' ? '返回列表' : 'Back to List'}</button>} /></main></div>;
  }

  return (
    <div>
      <PlatformHeader
        language={language}
        onLanguageChange={handleLanguageChange}
        activePage="agents"
      />

      <main className="platform-container">
        {/* Header */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <button
              onClick={() => router.push('/agents')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--space-2)',
                color: 'var(--text-secondary)'
              }}
            >
              ← {language === 'zh' ? '返回' : 'Back'}
            </button>
            <div>
              <div className="page-header-title-row">
                <h1 className="page-title">{agent.name}</h1>
                <div className="page-header-inline-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => router.push(`/agents/${agentId}/test`)}
                  >
                    {language === 'zh' ? '测试执行' : 'Test'}
                  </button>
                  <button
                    className="header-btn-primary"
                    onClick={handlePublish}
                    disabled={publishing}
                  >
                    {publishing
                      ? language === 'zh' ? '发布中...' : 'Publishing...'
                      : language === 'zh' ? '发布版本' : 'Publish'}
                  </button>
                </div>
              </div>
              <p className="page-subtitle">
                {agent.definition.description || (language === 'zh' ? '暂无描述' : 'No description')}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span
              style={{
                padding: 'var(--space-2) var(--space-3)',
                background: agent.status === 'draft' ? 'var(--gray-100)' : 'var(--green-100)',
                color: agent.status === 'draft' ? 'var(--gray-600)' : 'var(--green-600)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
            >
              {agent.status === 'draft'
                ? language === 'zh' ? '草稿' : 'Draft'
                : language === 'zh' ? '已发布' : 'Published'}
            </span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              v{agent.version}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
            <button
              className="nav-link active"
              style={{
                padding: 'var(--space-4) 0',
                borderBottom: '2px solid var(--primary)'
              }}
            >
              {language === 'zh' ? '概览' : 'Overview'}
            </button>
            <button
              className="nav-link"
              onClick={() => router.push(`/agents/${agentId}/versions`)}
            >
              {language === 'zh' ? '版本历史' : 'Versions'} ({versions.length})
            </button>
            <button
              className="nav-link"
              onClick={() => router.push(`/agents/${agentId}/test`)}
            >
              {language === 'zh' ? '测试' : 'Test'}
            </button>
          </div>
        </div>

        {/* Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-8)' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Configuration */}
            <div className="card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                {language === 'zh' ? '配置信息' : 'Configuration'}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '模型' : 'Model'}
                  </label>
                  <p style={{ fontWeight: 500 }}>{agent.definition.model || 'gpt-4'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '温度' : 'Temperature'}
                  </label>
                  <p style={{ fontWeight: 500 }}>{agent.definition.temperature ?? 0.7}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '系统提示词' : 'System Prompt'}
                  </label>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                    {agent.definition.systemPrompt || (language === 'zh' ? '未设置' : 'Not set')}
                  </p>
                </div>
                {agent.definition.tools && agent.definition.tools.length > 0 && (
                  <div>
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {language === 'zh' ? '工具' : 'Tools'}
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                      {agent.definition.tools.map((tool, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--gray-100)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                          }}
                        >
                          {tool.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Workflow Preview */}
            {workflow && (
              <div className="card">
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                  {language === 'zh' ? '工作流' : 'Workflow'}
                </h2>
                <div style={{ padding: 'var(--space-4)', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {language === 'zh'
                      ? `${workflow.nodes?.length || 0} 个节点，${workflow.edges?.length || 0} 条连接`
                      : `${workflow.nodes?.length || 0} nodes, ${workflow.edges?.length || 0} edges`
                    }
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Quick Actions */}
            <div className="card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                {language === 'zh' ? '快速操作' : 'Quick Actions'}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => router.push(`/agents/${agentId}/test`)}
                >
                  {language === 'zh' ? '🧪 测试执行' : '🧪 Test Run'}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing
                    ? language === 'zh' ? '发布中...' : 'Publishing...'
                    : language === 'zh' ? '📦 发布新版本' : '📦 Publish Version'}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                  onClick={() => router.push(`/agents/${agentId}/versions`)}
                >
                  {language === 'zh' ? '📚 版本历史' : '📚 Version History'}
                </button>
              </div>
            </div>

            {/* Metadata */}
            <div className="card">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                {language === 'zh' ? '元信息' : 'Metadata'}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '创建时间' : 'Created'}
                  </label>
                  <p style={{ fontSize: '0.875rem' }}>
                    {new Date(agent.created_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '更新时间' : 'Updated'}
                  </label>
                  <p style={{ fontSize: '0.875rem' }}>
                    {new Date(agent.updated_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Agent ID
                  </label>
                  <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                    {agent.id}
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Versions */}
            {versions.length > 0 && (
              <div className="card">
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                  {language === 'zh' ? '最近版本' : 'Recent Versions'}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {versions.slice(0, 3).map((ver) => (
                    <div
                      key={ver.id}
                      style={{
                        padding: 'var(--space-3)',
                        background: 'var(--gray-50)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem'
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>v{ver.version}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {new Date(ver.published_at).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US')}
                      </div>
                    </div>
                  ))}
                  {versions.length > 3 && (
                    <button
                      className="btn btn-secondary"
                      style={{ width: '100%', fontSize: '0.875rem' }}
                      onClick={() => router.push(`/agents/${agentId}/versions`)}
                    >
                      {language === 'zh' ? `查看全部 ${versions.length} 个版本` : `View All ${versions.length} Versions`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
