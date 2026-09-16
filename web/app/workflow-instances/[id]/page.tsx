'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { Language } from '../../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../../lib/api';
import { errorMessage } from '../../../lib/errors';
import PlatformHeader from '../../components/PlatformHeader';
import { useConfirm, useNotifier } from '../../components/NotificationProvider';
import ErrorState from '../../components/ErrorState';
import '../../design-system.css';

type WorkflowInstance = {
  id: string;
  workflow_id: string;
  run_id: string | null;
  status: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type Event = {
  event: string;
  sequence?: number;
  data?: unknown;
};

export default function WorkflowInstancePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const notify = useNotifier();
  const confirm = useConfirm();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [instance, setInstance] = React.useState<WorkflowInstance | null>(null);
  const [events, setEvents] = React.useState<Event[]>([]);
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
    loadInstance();
  }, [token, params.id, router]);

  const loadInstance = async () => {
    if (!token || !params.id) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<WorkflowInstance>(
        apiBaseUrl,
        `/api/v1/workflow-instances/${params.id}`,
        token,
        {cache: 'no-store'}
      );
      setInstance(result.data);

      // 如果有 run_id，加载事件流
      if (result.data.run_id) {
        try {
          const eventsResponse = await fetch(
            `${apiBaseUrl}/api/v1/runs/${result.data.run_id}/events`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (eventsResponse.ok) {
            const text = await eventsResponse.text();
            const parsed: Event[] = [];
            for (const block of text.split('\n\n')) {
              const eventMatch = block.match(/^event:\s*(.+)$/m);
              const dataMatch = block.match(/^data:\s*(.+)$/m);
              if (eventMatch && dataMatch) {
                try {
                  const payload = JSON.parse(dataMatch[1]);
                  parsed.push({
                    event: eventMatch[1],
                    sequence: payload.sequence,
                    data: payload.data
                  });
                } catch {
                  // ignore malformed event
                }
              }
            }
            setEvents(parsed);
          }
        } catch (error) {
          console.error('Failed to load events:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load instance:', error);
      setInstance(null);
      setError(errorMessage(error, language === 'zh' ? '加载工作流实例失败' : 'Failed to load workflow instance'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!token || !instance || !(await confirm(language === 'zh' ? '确定要取消此实例吗？' : 'Cancel this instance?', language === 'zh' ? '取消实例' : 'Cancel instance'))) return;
    try {
      await apiRequest(
        apiBaseUrl,
        `/api/v1/workflow-instances/${instance.id}/cancel`,
        token,
        { method: 'POST' }
      );
      notify(language === 'zh' ? '实例已取消' : 'Instance cancelled', 'success');
      await loadInstance();
    } catch (error: unknown) {
      notify(language === 'zh' ? `取消失败: ${errorMessage(error)}` : `Failed: ${errorMessage(error)}`, 'error');
    }
  };

  const handleRetry = async () => {
    if (!token || !instance?.run_id) return;
    try {
      const result = await apiRequest<{ id: string }>(
        apiBaseUrl,
        `/api/v1/runs/${instance.run_id}/replay`,
        token,
        { method: 'POST' }
      );
      notify(language === 'zh' ? '已创建重试运行' : 'Retry created', 'success');
      router.push(`/runs/${result.data.id}`);
    } catch (error: unknown) {
      notify(language === 'zh' ? `重试失败: ${errorMessage(error)}` : `Failed: ${errorMessage(error)}`, 'error');
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  const terminalStatuses = new Set(['completed', 'failed', 'cancelled', 'timed_out', 'budget_exceeded']);

  if (loading) {
    return (
      <div>
        <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="workflows" />
        <main className="platform-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>{language === 'zh' ? '加载中...' : 'Loading...'}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error && !instance) {
    return (
      <div>
        <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="workflows" />
        <main className="platform-container">
          <ErrorState state="error" error={error} onRetry={() => void loadInstance()} />
          <button className="btn btn-secondary" onClick={() => router.push('/workflows')}>{language === 'zh' ? '返回列表' : 'Back to List'}</button>
        </main>
      </div>
    );
  }

  if (!instance) {
    return <div><PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="workflows" /><main className="platform-container"><ErrorState state="empty" emptyTitle={language === 'zh' ? '实例不存在' : 'Instance Not Found'} emptyAction={<button className="btn btn-secondary" onClick={() => router.push('/workflows')}>{language === 'zh' ? '返回列表' : 'Back to List'}</button>} /></main></div>;
  }

  return (
    <div>
      <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="workflows" />

      <main className="platform-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              <span className="gradient">{language === 'zh' ? '工作流实例' : 'Workflow Instance'}</span>
            </h1>
            <p className="page-subtitle">
              ID: {instance.id} · {language === 'zh' ? '工作流' : 'Workflow'}: {instance.workflow_id}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            {!terminalStatuses.has(instance.status) && (
              <button className="btn btn-secondary" onClick={handleCancel} style={{ color: 'var(--error)' }}>
                {language === 'zh' ? '取消执行' : 'Cancel'}
              </button>
            )}
            {instance.status === 'failed' && (
              <button className="btn btn-secondary" onClick={handleRetry}>
                {language === 'zh' ? '重试' : 'Retry'}
              </button>
            )}
            <button className="btn btn-secondary" onClick={loadInstance}>
              {language === 'zh' ? '刷新' : 'Refresh'}
            </button>
            {instance.run_id && (
              <button className="btn btn-secondary" onClick={() => router.push(`/runs/${instance.run_id}`)}>
                {language === 'zh' ? '查看 Run' : 'View Run'}
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => router.push(`/workflows/${instance.workflow_id}`)}>
              {language === 'zh' ? '返回工作流' : 'Back to Workflow'}
            </button>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              {language === 'zh' ? '执行状态' : 'Execution Status'}
            </h2>
            <span className={`badge ${instance.status}`}>{instance.status}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', fontSize: '0.875rem' }}>
            <div>
              <strong>{language === 'zh' ? '创建时间' : 'Created'}:</strong>{' '}
              {new Date(instance.created_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}
            </div>
            <div>
              <strong>{language === 'zh' ? '更新时间' : 'Updated'}:</strong>{' '}
              {new Date(instance.updated_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}
            </div>
            {instance.run_id && (
              <div>
                <strong>Run ID:</strong> {instance.run_id}
              </div>
            )}
          </div>
        </div>

        {events.length > 0 && (
          <div className="card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-6)' }}>
              {language === 'zh' ? '执行事件' : 'Execution Events'} ({events.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: '600px', overflow: 'auto' }}>
              {events.map((event, index) => (
                <div key={index} style={{ padding: 'var(--space-4)', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <strong>{event.event}</strong>
                    {event.sequence !== undefined && (
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        #{event.sequence}
                      </span>
                    )}
                  </div>
                  {event.data !== undefined && (
                    <pre style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'auto' }}>
                      {String(JSON.stringify(event.data, null, 2))}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-6)' }}>
            {language === 'zh' ? '输入与输出' : 'Input & Output'}
          </h2>
          <pre style={{
            background: 'var(--gray-900)',
            color: '#d4d4d4',
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-md)',
            overflow: 'auto',
            fontSize: '0.875rem',
            lineHeight: 1.6
          }}>
            {JSON.stringify({ input: instance.input_json, output: instance.output_json }, null, 2)}
          </pre>
        </div>
      </main>
    </div>
  );
}
