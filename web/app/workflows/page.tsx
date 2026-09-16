'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { Language, getTranslation } from '../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../lib/api';
import PlatformHeader from '../components/PlatformHeader';
import ErrorState from '../components/ErrorState';
import { GitBranch } from 'lucide-react';
import '../design-system.css';

type Workflow = {
  id: string;
  name: string;
  description?: string;
  status?: string;
  created_at: string;
  updated_at: string;
};

export default function WorkflowsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
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
    loadWorkflows();
  }, [token, router]);

  const loadWorkflows = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<Workflow[]>(apiBaseUrl, '/api/v1/workflows', token);
      setWorkflows(result.data || []);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      setError(error instanceof Error ? error.message : '加载工作流失败');
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
        activePage="workflows"
      />

      {/* Main Content */}
      <main className="platform-container">
        <div className="page-header">
          <div className="page-header-title-row">
            <h1 className="page-title">
              {language === 'zh' ? (
                <><span className="gradient">工作流</span> 编排</>
              ) : (
                <><span className="gradient">Workflow</span> Orchestration</>
              )}
            </h1>
            <button className="header-btn-primary" onClick={() => router.push('/workflows/create')}>
              {language === 'zh' ? '+ 创建工作流' : '+ Create Workflow'}
            </button>
          </div>
          <p className="page-subtitle">
            {language === 'zh'
              ? '构建复杂的 Agent 工作流。支持 DAG 拓扑、条件节点和并行执行。'
              : 'Build complex Agent workflows. Supports DAG topology, conditional nodes and parallel execution.'}
          </p>
        </div>

        {loading ? (
          <ErrorState state="loading" loadingMessage={language === 'zh' ? '加载中...' : 'Loading...'} />
        ) : error ? (
          <ErrorState state="error" error={error} onRetry={() => void loadWorkflows()} />
        ) : workflows.length === 0 ? (
          <ErrorState className="empty-state directory-empty-state" state="empty" emptyIcon={<GitBranch size={30} />} emptyTitle={language === 'zh' ? '还没有工作流' : 'No Workflows Yet'} emptyDescription={language === 'zh' ? '创建您的第一个工作流来编排多个 Agent 协同工作' : 'Create your first workflow to orchestrate multiple Agents working together'} emptyAction={<button className="btn btn-primary btn-large" onClick={() => router.push('/workflows/create')}>
              {language === 'zh' ? '创建第一个工作流' : 'Create First Workflow'}
            </button>} />
        ) : (
          <div className="cards-grid">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="entity-card"
                onClick={() => router.push(`/workflows/${workflow.id}`)}
              >
                <div className="entity-icon">⚡</div>
                <h3 className="entity-name">{workflow.name}</h3>
                <p className="entity-description">
                  {workflow.description || (language === 'zh' ? '暂无描述' : 'No description')}
                </p>
                <div className="entity-footer">
                  <span className={`entity-status ${workflow.status || 'active'}`}>
                    {workflow.status || 'active'}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                    {new Date(workflow.updated_at).toLocaleDateString()}
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
