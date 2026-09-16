'use client';

import {FormEvent, useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {apiBaseUrl, apiRequest} from '../../lib/api';
import '../design-system.css';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setMessage('两次输入的密码不一致'); return; }
    setBusy(true);
    setMessage('');
    try {
      const token = params.get('token') ?? '';
      const result = await apiRequest<{message: string}>(apiBaseUrl, '/api/v1/auth/password-reset/confirm', undefined, {method: 'POST', body: JSON.stringify({token, new_password: password})});
      setMessage(result.data.message);
      setDone(true);
    } catch (cause) {
      setMessage(cause instanceof Error && cause.message === 'RESET_TOKEN_EXPIRED' ? '重置链接已过期，请重新申请。' : '重置链接无效，请重新申请。');
    } finally { setBusy(false); }
  }

  return <main className="auth-shell"><div className="auth-container"><div className="auth-brand"><div className="auth-logo">A</div><h1>Agent 平台</h1><p>设置新密码</p></div><section className="auth-card" aria-labelledby="reset-title"><h2 id="reset-title">重置密码</h2>{done ? <><div className="auth-success" role="status">{message}</div><Link className="btn btn-primary auth-submit" href="/login">返回登录</Link></> : <form onSubmit={submit} className="auth-form"><label className="form-field"><span>新密码</span><input className="form-input" required minLength={12} maxLength={128} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /><small>至少 12 个字符</small></label><label className="form-field"><span>确认新密码</span><input className="form-input" required minLength={12} maxLength={128} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></label>{message && <div className="auth-error" role="alert">{message}</div>}<button className="btn btn-primary auth-submit" disabled={busy}>{busy ? '正在保存...' : '保存新密码'}</button></form>}</section></div></main>;
}
