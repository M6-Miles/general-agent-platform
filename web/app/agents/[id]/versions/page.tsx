'use client';
import {useEffect, useState} from 'react';
import {useParams, useRouter} from 'next/navigation';
import PlatformHeader from '../../../components/PlatformHeader';
import {useAuth} from '../../../components/AuthProvider';
import {useConfirm, useNotifier} from '../../../components/NotificationProvider';
import {apiBaseUrl, apiRequest} from '../../../../lib/api';
import {parseApiDate} from '../../../../lib/date';
import {can} from '../../../../lib/permissions';
import {Language} from '../../../../lib/i18n';
import '../../../design-system.css';
import ErrorState from '../../../components/ErrorState';
import { errorMessage } from '../../../../lib/errors';

type Version = {id: string; version: number; content_digest: string; published_at: string};
export default function AgentVersions() {
  const {token, user} = useAuth();
  const notify = useNotifier();
  const confirm = useConfirm();
  const params = useParams<{id: string}>();
  const router = useRouter();
  const [versions, setVersions] = useState<Version[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState<Language>('zh');

  useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    if (token && params.id) void loadVersions();
  }, [token, params.id, router]);
  async function loadVersions() {
    if (!token || !params.id) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<Version[]>(apiBaseUrl, `/api/v1/agents/${params.id}/versions`, token);
      setVersions(result.data || []);
    } catch (cause) {
      setError(errorMessage(cause, '加载版本历史失败'));
    } finally {
      setLoading(false);
    }
  }
  async function rollback(version: number) {
    if (!(await confirm(`创建基于 v${version} 的新发布版本？`, '创建发布版本'))) return;
    try {
      await apiRequest(apiBaseUrl, `/api/v1/agents/${params.id}/rollback`, token, {
        method: 'POST',
        body: JSON.stringify({version})
      });
      const success = `已从 v${version} 创建新版本`;
      setMessage(success);
      notify(success, 'success');
      await loadVersions();
    } catch (cause) {
      const failure = String(cause);
      setMessage(failure);
      notify(`回滚失败：${failure}`, 'error');
    }
  }

  const canRollback = can(user?.role, 'agent:write');

  return (
    <div>
      <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="agents" />
      <main className="platform-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              <span className="gradient">Agent</span> 版本历史
            </h1>
            <p className="page-subtitle">查看和管理 Agent 的发布版本</p>
          </div>
          <button className="btn btn-secondary" onClick={() => router.push(`/agents/${params.id}`)}>
            返回 Agent
          </button>
        </div>

        {message && (
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--gray-50)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-6)',
            color: 'var(--text-secondary)'
          }}>
            {message}
          </div>
        )}

        <div className="card">
          {loading ? <ErrorState state="loading" /> : error ? <ErrorState state="error" error={error} onRetry={() => void loadVersions()} /> : versions.length === 0 ? (
            <ErrorState state="empty" emptyTitle="还没有发布版本" emptyDescription="发布 Agent 后版本历史将显示在这里" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontWeight: 600 }}>版本</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontWeight: 600 }}>发布时间</th>
                    <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontWeight: 600 }}>内容摘要</th>
                    {canRollback && <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontWeight: 600 }}>操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {versions.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <strong>v{item.version}</strong>
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                        {parseApiDate(item.published_at).toLocaleString('zh-CN')}
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <code style={{
                          fontSize: '0.875rem',
                          background: 'var(--gray-100)',
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: 'var(--radius-sm)'
                        }}>
                          {item.content_digest.slice(0, 12)}...
                        </code>
                      </td>
                      {canRollback && (
                        <td style={{ padding: 'var(--space-3)' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => void rollback(item.version)}
                            style={{ fontSize: '0.875rem', padding: 'var(--space-2) var(--space-3)' }}
                          >
                            回滚到此版本
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
