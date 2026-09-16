'use client';

import {FormEvent, useState} from 'react';
import Workspace from '../../components/Workspace';
import Input from '../../components/Input';
import {useAuth} from '../../components/AuthProvider';
import {apiBaseUrl, apiRequest} from '../../../lib/api';

export default function UsersPage() {
  const {token, user} = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{email: string; temporary_password: string} | null>(null);
  const [error, setError] = useState('');

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await apiRequest<{email: string; temporary_password: string; role: string}>(apiBaseUrl, '/api/v1/auth/invite', token, {method: 'POST', body: JSON.stringify({email, display_name: displayName})});
      setResult(response.data);
      setEmail('');
      setDisplayName('');
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '邀请失败';
      setError(code === 'USER_ALREADY_EXISTS' ? '该邮箱已经在当前租户中' : code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Workspace title="成员管理">
      <section className="panel" style={{maxWidth: 720}}>
        <div className="catalog-header"><div><h2>邀请成员</h2><p>创建一个普通成员账号，并生成一次性临时密码。请安全地复制给对方。</p></div></div>
        <form className="settings-form" onSubmit={invite}>
          <label><span className="label-text">姓名</span><Input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="成员姓名" /></label>
          <label><span className="label-text">邮箱</span><Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="member@example.com" /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="btn-primary" type="submit" disabled={busy || user?.role === 'member'}>{busy ? '正在生成...' : '生成邀请凭据'}</button></div>
        </form>
        {result && <div className="invite-result" role="status"><strong>邀请凭据（只显示这一次）</strong><dl><div><dt>邮箱</dt><dd>{result.email}</dd></div><div><dt>临时密码</dt><dd><code>{result.temporary_password}</code></dd></div></dl><p>成员登录后请立即在“设置 → 安全设置”中修改密码。</p></div>}
      </section>
    </Workspace>
  );
}
