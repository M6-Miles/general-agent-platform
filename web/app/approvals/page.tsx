'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { Language } from '../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../lib/api';
import PlatformHeader from '../components/PlatformHeader';
import { useNotifier, usePrompt } from '../components/NotificationProvider';
import ErrorState from '../components/ErrorState';
import '../design-system.css';

type Approval = {
  id: string;
  run_id: string;
  tool_call_id: string;
  tool_name: string;
  status: string;
  risk_level: string;
  created_at: string;
  expires_at: string;
  input_json: Record<string, unknown>;
};

export default function ApprovalsPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const notify = useNotifier();
  const prompt = usePrompt();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [approvals, setApprovals] = React.useState<Approval[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    void loadApprovals();
  }, [ready, token, router]);

  const loadApprovals = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<Approval[]>(apiBaseUrl, '/api/v1/approvals', token);
      setApprovals(result.data || []);
    } catch (error) {
      console.error('Failed to load approvals:', error);
      setError(error instanceof Error ? error.message : '加载审批列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (approvalId: string, decision: 'approve' | 'reject') => {
    if (!token) return;

    // 请求审批令牌（32-128字符）
    const approvalToken = await prompt(
      language === 'zh'
        ? '请输入审批令牌（32-128字符）：'
        : 'Enter approval token (32-128 characters):',
      language === 'zh' ? '审批令牌' : 'Approval token'
    );

    if (!approvalToken) return;

    if (approvalToken.length < 32 || approvalToken.length > 128) {
      notify(language === 'zh'
        ? '审批令牌长度必须在32-128字符之间'
        : 'Token length must be between 32-128 characters', 'error');
      return;
    }

    const reason = await prompt(
      language === 'zh'
        ? '请输入决策理由（可选）：'
        : 'Enter reason (optional):',
      language === 'zh' ? '决策理由' : 'Decision reason'
    ) || '';

    try {
      await apiRequest(apiBaseUrl, `/api/v1/approvals/${approvalId}/decision`, token, {
        method: 'POST',
        body: JSON.stringify({ decision, reason, token: approvalToken })
      });
      notify(language === 'zh' ? '操作成功' : 'Success', 'success');
      void loadApprovals();
    } catch (error) {
      console.error('Failed to submit decision:', error);
      notify(language === 'zh' ? '操作失败，请检查令牌是否正确' : 'Operation failed, please check token', 'error');
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
        activePage="approvals"
      />

      {/* Main Content */}
      <main className="platform-container">
        <div className="page-header">
          <h1 className="page-title">
            {language === 'zh' ? (
              <><span className="gradient">待审批</span> 操作</>
            ) : (
              <><span className="gradient">Pending</span> Approvals</>
            )}
          </h1>
          <p className="page-subtitle">
            {language === 'zh'
              ? '审批高风险工具调用。超时未决策的请求自动拒绝。'
              : 'Approve high-risk tool calls. Timeout requests are automatically rejected.'}
          </p>
        </div>

        {loading ? (
          <ErrorState state="loading" loadingMessage={language === 'zh' ? '加载中...' : 'Loading...'} />
        ) : error ? (
          <ErrorState state="error" error={error} onRetry={() => void loadApprovals()} />
        ) : approvals.length === 0 ? (
          <ErrorState
            state="empty"
            emptyIcon="✅"
            emptyTitle={language === 'zh' ? '没有待审批项' : 'No Pending Approvals'}
            emptyDescription={language === 'zh' ? '当前没有需要审批的操作' : 'No operations require approval at this time'}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {approvals.map((approval) => (
              <div
                key={approval.id}
                className="approval-item"
                data-run-id={approval.run_id}
                style={{
                  background: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-6)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{approval.tool_name}</h3>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: `${riskLevelColors[approval.risk_level]}15`,
                        color: riskLevelColors[approval.risk_level]
                      }}>
                        {approval.risk_level}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Run ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{approval.run_id.substring(0, 12)}...</span>
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      {language === 'zh' ? '创建时间' : 'Created'}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      {new Date(approval.created_at).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: 'var(--space-1)' }}>
                      {language === 'zh' ? '过期时间' : 'Expires'}: {new Date(approval.expires_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'var(--gray-50)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-4)'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
                    {language === 'zh' ? '输入参数' : 'Input Parameters'}
                  </div>
                  <pre style={{
                    fontSize: '0.875rem',
                    fontFamily: 'var(--font-mono)',
                    overflow: 'auto',
                    margin: 0
                  }}>
                    {JSON.stringify(approval.input_json, null, 2)}
                  </pre>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => handleDecision(approval.id, 'reject')}
                    className="btn btn-secondary"
                  >
                    {language === 'zh' ? '拒绝' : 'Reject'}
                  </button>
                  <button
                    onClick={() => handleDecision(approval.id, 'approve')}
                    className="btn btn-primary"
                  >
                    {language === 'zh' ? '批准' : 'Approve'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
