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

type AuditEvent = {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  actor_id?: string;
  outcome: string;
  created_at: string;
};

export default function AuditPage() {
  const router = useRouter();
  const { token, user, ready } = useAuth();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [events, setEvents] = React.useState<AuditEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [exporting, setExporting] = React.useState(false);

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
    loadAuditEvents();
  }, [token, router]);

  const loadAuditEvents = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<AuditEvent[]>(apiBaseUrl, '/api/v1/audit', token);
      setEvents(result.data || []);
    } catch (error) {
      console.error('Failed to load audit events:', error);
      setError(error instanceof Error ? error.message : '加载审计日志失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  const exportAudit = async () => {
    if (!token || exporting) return;
    setExporting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/audit/export`, {
        credentials: 'include',
        headers: {Authorization: `Bearer ${token}`},
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'audit.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export audit events:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PlatformHeader
        language={language}
        onLanguageChange={handleLanguageChange}
        activePage="audit"
      />

      {/* Main Content */}
      <main className="platform-container">
        <div className="page-header">
          <h1 className="page-title">
            {language === 'zh' ? (
              <><span className="gradient">审计</span> 日志</>
            ) : (
              <><span className="gradient">Audit</span> Trail</>
            )}
          </h1>
          <p className="page-subtitle">
            {language === 'zh'
              ? '全链路审计追踪。记录所有操作、变更和访问历史，满足合规要求。'
              : 'Full audit trail tracking. Record all operations, changes and access history for compliance.'}
          </p>
          {ready && can(user?.role, 'audit:export') && (
            <button className="btn btn-secondary" onClick={() => void exportAudit()} disabled={exporting}>
              {exporting ? '导出中...' : '导出日志'}
            </button>
          )}
        </div>

        {loading ? (
          <ErrorState state="loading" loadingMessage={language === 'zh' ? '加载中...' : 'Loading...'} />
        ) : error ? (
          <ErrorState state="error" error={error} onRetry={() => void loadAuditEvents()} />
        ) : events.length === 0 ? (
          <ErrorState
            state="empty"
            emptyIcon="🔍"
            emptyTitle={language === 'zh' ? '还没有审计记录' : 'No Audit Events Yet'}
            emptyDescription={language === 'zh' ? '系统操作和变更将自动记录审计日志' : 'System operations and changes will be automatically logged'}
          />
        ) : (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '时间' : 'Time'}
                  </th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '操作' : 'Action'}
                  </th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '资源类型' : 'Resource Type'}
                  </th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '资源ID' : 'Resource ID'}
                  </th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'zh' ? '结果' : 'Outcome'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {new Date(event.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: '0.875rem', fontWeight: 500 }}>
                      {event.action}
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {event.resource_type}
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {event.resource_id.substring(0, 8)}...
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span className={`entity-status ${event.outcome === 'success' ? 'active' : 'draft'}`}>
                        {event.outcome}
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
