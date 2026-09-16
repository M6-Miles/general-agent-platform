'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { Language, getTranslation } from '../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../lib/api';
import PlatformHeader from '../components/PlatformHeader';
import ErrorState from '../components/ErrorState';
import '../design-system.css';

type Run = {
  id: string;
  agent_id?: string;
  workflow_instance_id?: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export default function RunsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [runs, setRuns] = React.useState<Run[]>([]);
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
    loadRuns();
  }, [token, router]);

  const loadRuns = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<Run[]>(apiBaseUrl, '/api/v1/runs', token);
      setRuns(result.data || []);
    } catch (error) {
      console.error('Failed to load runs:', error);
      setError(error instanceof Error ? error.message : '加载运行记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'gray',
      running: 'blue',
      completed: 'green',
      failed: 'red',
      cancelled: 'orange'
    };
    return colors[status] || 'gray';
  };

  return (
    <div>
      <PlatformHeader
        language={language}
        onLanguageChange={handleLanguageChange}
        activePage="runs"
      />

      {/* Main Content */}
      <main className="platform-container">
        <div className="page-header">
          <h1 className="page-title">
            {language === 'zh' ? (
              <><span className="gradient">运行</span> 记录</>
            ) : (
              <><span className="gradient">Run</span> History</>
            )}
          </h1>
          <p className="page-subtitle">
            {language === 'zh'
              ? '查看所有 Agent 和工作流的执行历史。追踪状态、性能和结果。'
              : 'View execution history of all Agents and Workflows. Track status, performance and results.'}
          </p>
        </div>

        {loading ? (
          <ErrorState state="loading" loadingMessage={language === 'zh' ? '加载中...' : 'Loading...'} />
        ) : error ? (
          <ErrorState state="error" error={error} onRetry={() => void loadRuns()} />
        ) : runs.length === 0 ? (
          <ErrorState
            state="empty"
            emptyIcon="📊"
            emptyTitle={language === 'zh' ? '还没有运行记录' : 'No Run History Yet'}
            emptyDescription={language === 'zh' ? '运行 Agent 或工作流后，执行记录将显示在这里' : 'Run history will appear here after executing Agents or Workflows'}
            emptyAction={<button className="btn btn-primary btn-large" onClick={() => router.push('/agents')}>
              {language === 'zh' ? '查看 Agent' : 'View Agents'}
            </button>}
          />
        ) : (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? 'ID' : 'ID'}
                  </th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '状态' : 'Status'}
                  </th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '创建时间' : 'Created'}
                  </th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '更新时间' : 'Updated'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => router.push(`/runs/${run.id}`)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      transition: 'background var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: 'var(--space-4)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {run.id.substring(0, 8)}...
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span className={`entity-status ${run.status}`}>
                        {run.status}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {new Date(run.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
