'use client';

import React from 'react';
import {KeyRound, Save, Settings2, UserRound} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {useAuth} from '../components/AuthProvider';
import {useNotifier} from '../components/NotificationProvider';
import {Language} from '../../lib/i18n';
import {apiBaseUrl, apiRequest} from '../../lib/api';
import PlatformHeader from '../components/PlatformHeader';
import '../design-system.css';

type Tab = 'profile' | 'security' | 'preferences';
type Preferences = Record<string, unknown>;
type Profile = {id: string; email: string; display_name: string; role: string; preferences: Preferences};

const languageLabels: Record<Language, {title: string; profile: string; security: string; preferences: string; save: string; saving: string; savePassword: string; savePreferences: string; loadError: string; loading: string; retry: string; saved: string; passwordSaved: string; languageSaved: string; profileDesc: string; securityDesc: string; preferencesDesc: string; displayName: string; email: string; emailImmutable: string; currentPassword: string; newPassword: string; confirmPassword: string; passwordHint: string; interfaceLanguage: string; timezone: string; emailNotifications: string; emailNotificationsHint: string}> = {
  zh: {title: '个人设置', profile: '个人资料', security: '安全设置', preferences: '偏好设置', save: '保存更改', saving: '保存中...', savePassword: '更新密码', savePreferences: '保存偏好', loadError: '设置加载失败', loading: '正在加载设置...', retry: '重试', saved: '个人资料已保存', passwordSaved: '密码已更新，请使用新密码登录', languageSaved: '偏好设置已保存', profileDesc: '更新平台中显示的名称。', securityDesc: '修改密码后，下一次登录使用新密码。', preferencesDesc: '修改后点击保存，新的偏好才会生效。', displayName: '显示名称', email: '邮箱', emailImmutable: '邮箱不可更改', currentPassword: '当前密码', newPassword: '新密码', confirmPassword: '确认新密码', passwordHint: '至少 12 个字符', interfaceLanguage: '界面语言', timezone: '时区', emailNotifications: '邮件通知', emailNotificationsHint: '接收重要更新和通知'},
  en: {title: 'User Settings', profile: 'Profile', security: 'Security', preferences: 'Preferences', save: 'Save changes', saving: 'Saving...', savePassword: 'Update password', savePreferences: 'Save preferences', loadError: 'Unable to load settings', loading: 'Loading settings...', retry: 'Retry', saved: 'Profile saved', passwordSaved: 'Password updated. Use the new password next time.', languageSaved: 'Preferences saved', profileDesc: 'Update the name shown across the platform.', securityDesc: 'Change the password used for your next sign-in.', preferencesDesc: 'Changes take effect after you save your preferences.', displayName: 'Display name', email: 'Email', emailImmutable: 'Email cannot be changed', currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm new password', passwordHint: 'At least 12 characters', interfaceLanguage: 'Interface language', timezone: 'Timezone', emailNotifications: 'Email notifications', emailNotificationsHint: 'Receive important updates and notifications'},
  ja: {title: '個人設定', profile: 'プロフィール', security: 'セキュリティ', preferences: '環境設定', save: '変更を保存', saving: '保存中...', savePassword: 'パスワードを更新', savePreferences: '環境設定を保存', loadError: '設定を読み込めません', loading: '設定を読み込んでいます...', retry: '再試行', saved: 'プロフィールを保存しました', passwordSaved: 'パスワードを更新しました', languageSaved: '環境設定を保存しました', profileDesc: 'プラットフォームに表示する名前を更新します。', securityDesc: '次回のサインインに使用するパスワードを変更します。', preferencesDesc: '保存すると新しい設定が反映されます。', displayName: '表示名', email: 'メールアドレス', emailImmutable: 'メールアドレスは変更できません', currentPassword: '現在のパスワード', newPassword: '新しいパスワード', confirmPassword: '新しいパスワード（確認）', passwordHint: '12文字以上', interfaceLanguage: '表示言語', timezone: 'タイムゾーン', emailNotifications: 'メール通知', emailNotificationsHint: '重要な更新と通知を受け取る'},
};

function normalizeLanguage(value: unknown): Language | null {
  if (value === 'zh' || value === 'zh-CN') return 'zh';
  if (value === 'en' || value === 'en-US') return 'en';
  if (value === 'ja' || value === 'ja-JP') return 'ja';
  return null;
}

function errorMessage(cause: unknown, language: Language): string {
  const code = cause instanceof Error ? cause.message : String(cause);
  const labels: Record<string, Record<Language, string>> = {
    CURRENT_PASSWORD_INVALID: {zh: '当前密码不正确', en: 'The current password is incorrect', ja: '現在のパスワードが正しくありません'},
    HTTP_400: {zh: '提交内容不符合要求', en: 'The submitted values are invalid', ja: '入力内容が正しくありません'},
  };
  return labels[code]?.[language] ?? code;
}

export default function SettingsPage() {
  const router = useRouter();
  const {token} = useAuth();
  const notify = useNotifier();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [activeTab, setActiveTab] = React.useState<Tab>('profile');
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [displayName, setDisplayName] = React.useState('');
  const [draftLanguage, setDraftLanguage] = React.useState<Language>('zh');
  const [timezone, setTimezone] = React.useState('Asia/Shanghai');
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const copy = languageLabels[language];

  const loadProfile = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<Profile>(apiBaseUrl, '/api/v1/settings/profile', token, {cache: 'no-store'});
      const data = result.data;
      const preferences = data.preferences ?? {};
      const storedLanguage = normalizeLanguage(preferences.language) ?? normalizeLanguage(localStorage.getItem('preferred-language')) ?? 'zh';
      setProfile(data);
      setDisplayName(data.display_name);
      setLanguage(storedLanguage);
      setDraftLanguage(storedLanguage);
      setTimezone(typeof preferences.timezone === 'string' ? preferences.timezone : 'Asia/Shanghai');
      setEmailNotifications(preferences.email_notifications !== false);
    } catch (cause) {
      setError(errorMessage(cause, language));
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    const stored = normalizeLanguage(localStorage.getItem('preferred-language'));
    if (stored) {
      setLanguage(stored);
      setDraftLanguage(stored);
    }
  }, []);

  React.useEffect(() => {
    if (!token) router.push('/login');
    else void loadProfile();
  }, [loadProfile, router, token]);

  const handleHeaderLanguageChange = (next: Language) => {
    setLanguage(next);
    localStorage.setItem('preferred-language', next);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !profile || !displayName.trim()) return;
    setSaving(true);
    try {
      const result = await apiRequest<Profile>(apiBaseUrl, '/api/v1/settings/profile', token, {
        method: 'PUT',
        body: JSON.stringify({display_name: displayName.trim(), preferences: profile.preferences ?? {}}),
      });
      setProfile(result.data);
      setDisplayName(result.data.display_name);
      notify(copy.saved, 'success');
    } catch (cause) {
      notify(errorMessage(cause, language), 'error');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || newPassword.length < 12 || newPassword !== confirmPassword) return;
    setSaving(true);
    try {
      await apiRequest(apiBaseUrl, '/api/v1/settings/password', token, {
        method: 'PUT',
        body: JSON.stringify({current_password: currentPassword, new_password: newPassword}),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify(copy.passwordSaved, 'success');
    } catch (cause) {
      notify(errorMessage(cause, language), 'error');
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !profile) return;
    setSaving(true);
    try {
      const preferences = {...profile.preferences, language: draftLanguage, timezone, email_notifications: emailNotifications};
      const result = await apiRequest<Profile>(apiBaseUrl, '/api/v1/settings/profile', token, {
        method: 'PUT',
        body: JSON.stringify({display_name: profile.display_name, preferences}),
      });
      setProfile(result.data);
      setLanguage(draftLanguage);
      localStorage.setItem('preferred-language', draftLanguage);
      notify(copy.languageSaved, 'success');
    } catch (cause) {
      notify(errorMessage(cause, language), 'error');
    } finally {
      setSaving(false);
    }
  };

  const passwordError = newPassword && newPassword !== confirmPassword ? (language === 'zh' ? '两次输入的新密码不一致' : language === 'ja' ? '新しいパスワードが一致しません' : 'Passwords do not match') : '';
  const passwordReady = currentPassword.length >= 12 && newPassword.length >= 12 && newPassword === confirmPassword;

  if (!token) return null;

  return <div className="settings-page">
    <PlatformHeader language={language} onLanguageChange={handleHeaderLanguageChange} activePage="" />
    <main className="platform-container settings-container">
      <header className="settings-page-header">
        <div className="settings-title-mark"><Settings2 size={28} aria-hidden="true" /></div>
        <div>
          <h1>{copy.title}</h1>
          <p>{language === 'zh' ? '管理账户资料、安全选项和界面偏好。' : language === 'ja' ? 'アカウント、セキュリティ、表示設定を管理します。' : 'Manage your account, security, and interface preferences.'}</p>
        </div>
      </header>

      <div className="settings-tabs" role="tablist" aria-label={copy.title}>
        {([['profile', copy.profile, UserRound], ['security', copy.security, KeyRound], ['preferences', copy.preferences, Settings2]] as const).map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
          <Icon size={16} aria-hidden="true" />{label}
        </button>)}
      </div>

      {loading ? <section className="settings-card settings-state" role="status">{copy.loading}</section>
        : error ? <section className="settings-card settings-state" role="alert"><p>{copy.loadError}</p><button type="button" onClick={() => void loadProfile()}>{copy.retry}</button></section>
          : <>
            {activeTab === 'profile' && <form className="settings-card settings-form" onSubmit={saveProfile}>
              <div className="settings-card-heading"><div><h2>{copy.profile}</h2><p>{copy.profileDesc}</p></div><UserRound size={22} aria-hidden="true" /></div>
              <label><span>{copy.displayName}</span><input value={displayName} maxLength={200} required onChange={(event) => setDisplayName(event.target.value)} /></label>
              <label><span>{copy.email}</span><input value={profile?.email ?? ''} type="email" disabled /><small>{copy.emailImmutable}</small></label>
              <div className="settings-actions"><button className="btn btn-primary" type="submit" disabled={saving || !displayName.trim() || displayName.trim() === profile?.display_name}><Save size={16} aria-hidden="true" />{saving ? copy.saving : copy.save}</button></div>
            </form>}

            {activeTab === 'security' && <form className="settings-card settings-form" onSubmit={savePassword}>
              <div className="settings-card-heading"><div><h2>{copy.security}</h2><p>{copy.securityDesc}</p></div><KeyRound size={22} aria-hidden="true" /></div>
              <label><span>{copy.currentPassword}</span><input type="password" value={currentPassword} minLength={12} maxLength={128} required autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} /></label>
              <label><span>{copy.newPassword}</span><input type="password" value={newPassword} minLength={12} maxLength={128} required autoComplete="new-password" onChange={(event) => setNewPassword(event.target.value)} /><small>{copy.passwordHint}</small></label>
              <label><span>{copy.confirmPassword}</span><input type="password" value={confirmPassword} minLength={12} maxLength={128} required autoComplete="new-password" aria-invalid={Boolean(passwordError)} onChange={(event) => setConfirmPassword(event.target.value)} />{passwordError && <small className="field-error">{passwordError}</small>}</label>
              <div className="settings-actions"><button className="btn btn-primary" type="submit" disabled={saving || !passwordReady}><Save size={16} aria-hidden="true" />{saving ? copy.saving : copy.savePassword}</button></div>
            </form>}

            {activeTab === 'preferences' && <form className="settings-card settings-form" onSubmit={savePreferences}>
              <div className="settings-card-heading"><div><h2>{copy.preferences}</h2><p>{copy.preferencesDesc}</p></div><Settings2 size={22} aria-hidden="true" /></div>
              <label><span>{copy.interfaceLanguage}</span><select value={draftLanguage} onChange={(event) => setDraftLanguage(event.target.value as Language)}><option value="zh">中文</option><option value="en">English</option><option value="ja">日本語</option></select></label>
              <label><span>{copy.timezone}</span><select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option><option value="America/New_York">America/New_York (UTC-5)</option><option value="Europe/London">Europe/London (UTC+0)</option><option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option></select></label>
              <label className="settings-toggle"><span><b>{copy.emailNotifications}</b><small>{copy.emailNotificationsHint}</small></span><input type="checkbox" checked={emailNotifications} onChange={(event) => setEmailNotifications(event.target.checked)} /></label>
              <div className="settings-actions"><button className="btn btn-primary" type="submit" disabled={saving || (draftLanguage === language && timezone === (typeof profile?.preferences.timezone === 'string' ? profile.preferences.timezone : 'Asia/Shanghai') && emailNotifications === (profile?.preferences.email_notifications !== false))}><Save size={16} aria-hidden="true" />{saving ? copy.saving : copy.savePreferences}</button></div>
            </form>}
          </>}
    </main>
  </div>;
}
