'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { Language, getTranslation } from '../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../lib/api';
import { can } from '../../lib/permissions';
import PlatformHeader from '../components/PlatformHeader';
import ErrorState from '../components/ErrorState';
import '../design-system.css';

type Agent = {
  id: string;
  name: string;
  status: string;
  definition?: {
    description?: string;
  };
  created_at: string;
  updated_at: string;
};

export default function AgentsPage() {
  const router = useRouter();
  const { token, user, ready } = useAuth();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang && ['en', 'zh', 'ja'].includes(savedLang)) {
      setLanguage(savedLang);
    }
  }, []);

  React.useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadAgents();
  }, [token, router]);

  const loadAgents = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<Agent[]>(apiBaseUrl, '/api/v1/agents', token);
      setAgents(result.data || []);
    } catch (error) {
      console.error('Failed to load agents:', error);
      setError(error instanceof Error ? error.message : '加载 Agent 失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  return (
    <div>
      <PlatformHeader
        language={language}
        onLanguageChange={handleLanguageChange}
        activePage="agents"
      />

      {/* Main Content */}
      <main className="platform-container">
        <div className="page-header">
          <div className="page-header-title-row">
            <h1 className="page-title">
              {language === 'zh' ? (
                <><span className="gradient">Agent</span> 管理</>
              ) : (
                <><span className="gradient">Agent</span> Management</>
              )}
            </h1>
            {ready && can(user?.role, 'agent:write') && (
              <button className="header-btn-primary" onClick={() => router.push('/agents/create')}>
                {language === 'zh' ? '+ 创建 Agent' : '+ Create Agent'}
              </button>
            )}
          </div>
          <p className="page-subtitle">
            {language === 'zh'
              ? '创建、配置和管理您的 AI Agent。支持工具调用、版本管理和发布流程。'
              : 'Create, configure and manage your AI Agents. Supports tool calling, version management and publishing workflow.'}
          </p>
        </div>

        {loading ? (
          <ErrorState state="loading" loadingMessage={language === 'zh' ? '加载中...' : 'Loading...'} />
        ) : error ? (
          <ErrorState state="error" error={error} onRetry={() => void loadAgents()} />
        ) : agents.length === 0 ? (
          <ErrorState className="directory-empty-state" state="empty" emptyTitle={language === 'zh' ? '还没有 Agent' : 'No Agents Yet'} emptyDescription={language === 'zh' ? '创建您的第一个 Agent 来开始自动化工作流程' : 'Create your first Agent to start automating workflows'} emptyAction={ready && can(user?.role, 'agent:write') ? <button className="btn btn-primary btn-large" onClick={() => router.push('/agents/create')}>
              {language === 'zh' ? '创建第一个 Agent' : 'Create First Agent'}
            </button> : undefined} />
        ) : (
          <div className="cards-grid">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="entity-card"
                onClick={() => router.push(`/agents/${agent.id}`)}
              >
                <div className="entity-icon">🤖</div>
                <h3 className="entity-name">{agent.name}</h3>
                <p className="entity-description">
                  {agent.definition?.description || (language === 'zh' ? '暂无描述' : 'No description')}
                </p>
                <div className="entity-footer">
                  <span className={`entity-status ${agent.status}`}>
                    {agent.status}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                    {new Date(agent.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
