'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { Language } from '../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../lib/api';
import PlatformHeader from '../components/PlatformHeader';
import ErrorState from '../components/ErrorState';
import '../design-system.css';

type Tool = {
  id: string;
  name: string;
  description: string;
  executor: string;
  risk_level: string;
  status: string;
  version: number;
  created_at: string;
};

export default function ToolsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [tools, setTools] = React.useState<Tool[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  React.useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadTools();
  }, [token, router]);

  const loadTools = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<Tool[]>(apiBaseUrl, '/api/v1/tools', token);
      setTools(result.data || []);
    } catch (error) {
      console.error('Failed to load tools:', error);
      setError(error instanceof Error ? error.message : '加载工具失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  const riskLevelColors: Record<string, string> = {
    low: 'var(--success)',
    medium: 'var(--warning)',
    high: 'var(--error)',
    critical: 'var(--error-dark)'
  };

  return (
    <div>
      <PlatformHeader
        language={language}
        onLanguageChange={handleLanguageChange}
        activePage="tools"
      />

      {/* Main Content */}
      <main className="platform-container">
        <div className="page-header">
          <div className="page-header-title-row">
            <h1 className="page-title">
              {language === 'zh' ? (
                <><span className="gradient">工具</span> 管理</>
              ) : (
                <><span className="gradient">Tool</span> Management</>
              )}
            </h1>
            <button className="header-btn-primary" onClick={() => router.push('/tools/create')}>
              {language === 'zh' ? '+ 注册工具' : '+ Register Tool'}
            </button>
          </div>
          <p className="page-subtitle">
            {language === 'zh'
              ? '注册和管理 Agent 可调用的工具。支持自定义执行器、输入输出 schema 和风险级别。'
              : 'Register and manage tools callable by Agents. Supports custom executors, I/O schemas and risk levels.'}
          </p>
        </div>

        {loading ? (
          <ErrorState state="loading" loadingMessage={language === 'zh' ? '加载中...' : 'Loading...'} />
        ) : error ? (
          <ErrorState state="error" error={error} onRetry={() => void loadTools()} />
        ) : tools.length === 0 ? (
          <ErrorState
            className="directory-empty-state"
            state="empty"
            emptyIcon="🔧"
            emptyTitle={language === 'zh' ? '还没有工具' : 'No Tools Yet'}
            emptyDescription={language === 'zh' ? '注册第一个工具让 Agent 能够调用外部能力' : 'Register your first tool to enable external capabilities'}
            emptyAction={<button className="btn btn-primary btn-large" onClick={() => router.push('/tools/create')}>
              {language === 'zh' ? '注册第一个工具' : 'Register First Tool'}
            </button>}
          />
        ) : (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '工具名称' : 'Tool Name'}
                  </th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '执行器' : 'Executor'}
                  </th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '风险级别' : 'Risk Level'}
                  </th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '版本' : 'Version'}
                  </th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '状态' : 'Status'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => (
                  <tr
                    key={tool.id}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background var(--transition-fast)' }}
                    onClick={() => router.push(`/tools/${tool.id}`)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ fontWeight: 500 }}>{tool.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                        {tool.description}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {tool.executor}
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: `${riskLevelColors[tool.risk_level]}15`,
                        color: riskLevelColors[tool.risk_level]
                      }}>
                        {tool.risk_level}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      v{tool.version}
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span className={`entity-status ${tool.status}`}>
                        {tool.status}
                      </span>
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
