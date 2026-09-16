'use client';

import {FormEvent, useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {useAuth} from '../components/AuthProvider';
import '../design-system.css';

export default function LoginPage() {
  const {login, token, ready} = useAuth();
  const router = useRouter();
  const [nextPath, setNextPath] = useState('/');
  const [tenantSlug, setTenantSlug] = useState('demo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('next');
    setNextPath(requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/');
  }, []);

  useEffect(() => {
    if (ready && token) router.replace(nextPath);
  }, [ready, token, nextPath, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password, tenantSlug);
      router.replace(nextPath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div style={{ width: '100%', maxWidth: '440px', margin: '0 var(--space-6)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--primary)',
            marginBottom: 'var(--space-4)',
            boxShadow: 'var(--shadow-xl)'
          }}>A</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'white', marginBottom: 'var(--space-2)' }}>Agent 平台</h1>
          <p style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.9)' }}>可审计的 Agent Runtime</p>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'white',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-10)',
          boxShadow: 'var(--shadow-2xl)'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>登录工作台</h2>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-8)' }}>使用企业账号继续工作</p>

          <form onSubmit={submit}>
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label htmlFor="login-tenant" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
                租户标识
              </label>
              <input
                id="login-tenant"
                type="text"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                autoComplete="organization"
                style={{
                  width: '100%',
                  padding: 'var(--space-3) var(--space-4)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9375rem',
                  transition: 'all var(--transition-fast)',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label htmlFor="login-email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
                邮箱
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                style={{
                  width: '100%',
                  padding: 'var(--space-3) var(--space-4)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9375rem',
                  transition: 'all var(--transition-fast)',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label htmlFor="login-password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
                密码
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: 'var(--space-3) var(--space-4)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9375rem',
                  transition: 'all var(--transition-fast)',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {error && (
              <div style={{
                padding: 'var(--space-3) var(--space-4)',
                background: '#fef2f2',
                color: '#991b1b',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                marginBottom: 'var(--space-6)'
              }} role="alert" aria-live="polite">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: 'var(--space-4)',
                fontSize: '1rem',
                fontWeight: 600,
                justifyContent: 'center'
              }}
            >
              {busy ? '正在登录...' : '登录'}
            </button>

            <p style={{ fontSize: '0.875rem', textAlign: 'center', marginTop: 'var(--space-3)' }}>
              <a href="/forgot-password" style={{ color: 'var(--primary)', fontWeight: 600 }}>忘记密码？</a>
            </p>

            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              marginTop: 'var(--space-6)'
            }}>
              使用企业账号登录，数据仅在当前租户内可见
            </p>
            <p style={{ fontSize: '0.875rem', textAlign: 'center', marginTop: 'var(--space-3)' }}>
              还没有工作区？ <a href="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>注册一个演示工作区</a>
            </p>
          </form>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          fontSize: '0.875rem',
          color: 'rgba(255, 255, 255, 0.8)',
          marginTop: 'var(--space-8)'
        }}>
          © 2024 Agent Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
}
