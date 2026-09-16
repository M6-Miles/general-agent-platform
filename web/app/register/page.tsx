'use client';

import {FormEvent, useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useAuth} from '../components/AuthProvider';
import '../design-system.css';

export default function RegisterPage() {
  const {register, token, ready} = useAuth();
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && token) router.replace('/');
  }, [ready, token, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setBusy(true);
    try {
      await register(tenantSlug.trim().toLowerCase(), tenantName.trim(), email.trim(), displayName.trim(), password);
      router.replace('/');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '注册失败';
      setError(message === 'TENANT_ALREADY_EXISTS' ? '租户标识已存在，请换一个' : message === 'TENANT_OR_EMAIL_ALREADY_EXISTS' ? '租户或邮箱已存在，请检查后重试' : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-logo">A</div>
          <h1>Agent 平台</h1>
          <p>创建一个本地演示工作区</p>
        </div>
        <section className="auth-card" aria-labelledby="register-title">
          <h2 id="register-title">注册工作区</h2>
          <p className="auth-intro">注册后会创建一个新的租户，并自动成为该租户管理员。</p>
          <form onSubmit={submit} className="auth-form">
            <div className="auth-grid">
              <label className="form-field">
                <span>租户标识</span>
                <input className="form-input" required minLength={3} maxLength={100} pattern="[a-z0-9][a-z0-9-]*[a-z0-9]" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="例如：my-school" autoComplete="organization" />
                <small>仅使用小写字母、数字和连字符</small>
              </label>
              <label className="form-field">
                <span>租户名称</span>
                <input className="form-input" required maxLength={200} value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="例如：我的学校项目" />
              </label>
            </div>
            <label className="form-field">
              <span>显示名称</span>
              <input className="form-input" required maxLength={200} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="你的姓名" autoComplete="name" />
            </label>
            <label className="form-field">
              <span>邮箱</span>
              <input className="form-input" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
            </label>
            <div className="auth-grid">
              <label className="form-field">
                <span>密码</span>
                <input className="form-input" required minLength={12} maxLength={128} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                <small>至少 12 个字符</small>
              </label>
              <label className="form-field">
                <span>确认密码</span>
                <input className="form-input" required minLength={12} maxLength={128} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </label>
            </div>
            {error && <div className="auth-error" role="alert" aria-live="polite">{error}</div>}
            <button type="submit" disabled={busy} className="btn btn-primary auth-submit">{busy ? '正在创建...' : '创建工作区'}</button>
          </form>
          <p className="auth-switch">已有账号？ <Link href="/login">返回登录</Link></p>
        </section>
        <p className="auth-note">本地演示环境开放注册；生产环境请使用管理员邀请。</p>
      </div>
    </main>
  );
}
