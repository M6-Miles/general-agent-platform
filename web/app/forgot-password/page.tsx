'use client';

import {FormEvent, useState} from 'react';
import Link from 'next/link';
import {apiBaseUrl, apiRequest} from '../../lib/api';
import '../design-system.css';

export default function ForgotPasswordPage() {
  const [tenantSlug, setTenantSlug] = useState('school-demo');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [previewToken, setPreviewToken] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setPreviewToken('');
    try {
      const result = await apiRequest<{message: string; preview_token?: string}>(apiBaseUrl, '/api/v1/auth/password-reset/request', undefined, {method: 'POST', body: JSON.stringify({tenant_slug: tenantSlug, email})});
      setMessage(result.data.message);
      if (result.data.preview_token) setPreviewToken(result.data.preview_token);
    } catch {
      setMessage('请求已提交。如果账号存在，请检查邮箱。');
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-shell"><div className="auth-container"><div className="auth-brand"><div className="auth-logo">A</div><h1>Agent 平台</h1><p>找回你的工作区账号</p></div><section className="auth-card" aria-labelledby="forgot-title"><h2 id="forgot-title">忘记密码</h2><p className="auth-intro">输入租户和邮箱，我们会发送一条 15 分钟内有效的重置链接。</p><form onSubmit={submit} className="auth-form"><label className="form-field"><span>租户标识</span><input className="form-input" required value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} /></label><label className="form-field"><span>邮箱</span><input className="form-input" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label><button className="btn btn-primary auth-submit" disabled={busy}>{busy ? '正在发送...' : '发送重置链接'}</button></form>{message && <div className="auth-success" role="status">{message}</div>}{previewToken && <div className="auth-preview"><strong>本地演示重置入口</strong><Link href={`/reset-password?token=${encodeURIComponent(previewToken)}`}>打开密码重置页</Link></div>}<p className="auth-switch"><Link href="/login">返回登录</Link></p></section><p className="auth-note">生产环境需要配置 SMTP；本地演示未配置邮件时会显示预览入口。</p></div></main>;
}
