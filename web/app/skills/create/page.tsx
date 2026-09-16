'use client';

import React, { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { useNotifier } from '../../components/NotificationProvider';
import { apiBaseUrl, apiRequest } from '../../../lib/api';
import { can } from '../../../lib/permissions';
import { Language } from '../../../lib/i18n';
import PlatformHeader from '../../components/PlatformHeader';
import '../../design-system.css';

type Skill = { id: string };
type FormState = {
  slug: string;
  name: string;
  description: string;
  version: string;
  entrypoint: string;
  license: string;
  riskLevel: string;
  sideEffects: boolean;
};

const initial: FormState = {
  slug: '',
  name: '',
  description: '',
  version: '1.0.0',
  entrypoint: 'skill',
  license: 'MIT',
  riskLevel: 'low',
  sideEffects: false
};

export default function CreateSkill() {
  const { token, user, ready } = useAuth();
  const notify = useNotifier();
  const router = useRouter();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [form, setForm] = React.useState(initial);
  const [extraManifest, setExtraManifest] = React.useState<Record<string, unknown>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [fileName, setFileName] = React.useState('');

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    if (!token) router.replace('/login');
  }, [ready, token, router]);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function importManifest(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const manifest = JSON.parse(await file.text()) as Record<string, unknown>;
      if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object') {
        throw new Error('Manifest must be an object');
      }
      setExtraManifest(manifest);
      setFileName(file.name);
      setForm((current) => ({
        ...current,
        slug: String(manifest.id ?? current.slug),
        description: String(manifest.description ?? current.description),
        version: String(manifest.version ?? current.version),
        entrypoint: String(manifest.entrypoint ?? current.entrypoint),
        license: String(manifest.license ?? current.license),
        riskLevel: String(manifest.riskLevel ?? current.riskLevel),
        sideEffects: typeof manifest.sideEffects === 'boolean' ? manifest.sideEffects : current.sideEffects,
      }));
    } catch (cause) {
      setError(`Manifest parsing failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      event.target.value = '';
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const manifest = {
        ...extraManifest,
        entrypoint: form.entrypoint,
        license: form.license,
        riskLevel: form.riskLevel,
        sideEffects: form.sideEffects
      };
      const result = await apiRequest<Skill>(apiBaseUrl, '/api/v1/skills', token, {
        method: 'POST',
        body: JSON.stringify({
          slug: form.slug,
          name: form.name,
          description: form.description,
          version: form.version,
          manifest
        })
      });
      notify(language === 'zh' ? 'Skill 草稿已创建' : 'Skill draft created', 'success');
      router.push(`/skills/${result.data.id}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      notify(
        language === 'zh' ? `Skill 创建失败：${message}` : `Failed to create skill: ${message}`,
        'error'
      );
    } finally {
      setBusy(false);
    }
  }

  if (ready && user && !can(user.role, 'agent:write')) {
    return (
      <div>
        <PlatformHeader
          language={language}
          onLanguageChange={handleLanguageChange}
          activePage="skills"
        />
        <main className="platform-container">
          <div className="empty-state">
            <div className="empty-icon">🔒</div>
            <h3 className="empty-title">{language === 'zh' ? '无权创建 Skill' : 'No Permission'}</h3>
            <p className="empty-description">
              {language === 'zh'
                ? '请联系租户管理员完成能力包创建和审核。'
                : 'Please contact your tenant admin to create and review skills.'}
            </p>
            <button className="btn btn-secondary" onClick={() => router.push('/skills')}>
              {language === 'zh' ? '返回列表' : 'Back to List'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <PlatformHeader
        language={language}
        onLanguageChange={handleLanguageChange}
        activePage="skills"
      />

      <main className="platform-container">
        <div className="page-header">
          <h1 className="page-title">
            {language === 'zh' ? (
              <><span className="gradient">创建</span> Skill</>
            ) : (
              <><span className="gradient">Create</span> Skill</>
            )}
          </h1>
          <p className="page-subtitle">
            {language === 'zh'
              ? '填写能力包元数据，或导入符合规范的 JSON manifest。'
              : 'Fill in the skill metadata or import a JSON manifest.'}
          </p>
        </div>

        <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <form onSubmit={submit}>
            {/* Import Section */}
            <div style={{ marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-6)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  {language === 'zh' ? '导入 Manifest' : 'Import Manifest'}
                </label>
                <label className="btn btn-secondary" style={{ margin: 0, cursor: 'pointer' }}>
                  {language === 'zh' ? '📂 选择文件' : '📂 Choose File'}
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={importManifest}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              {fileName && (
                <div style={{
                  padding: 'var(--space-3)',
                  background: 'var(--success-light)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--success)',
                  fontSize: '0.875rem'
                }}>
                  ✓ {language === 'zh' ? '已导入' : 'Imported'}: {fileName}
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
              <div>
                <label className="form-label" htmlFor="skill-slug">
                  {language === 'zh' ? '标识 slug' : 'Slug'} <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                  <input
                  id="skill-slug"
                  type="text"
                  className="form-input"
                  required
                  pattern="[a-z0-9][a-z0-9._-]*"
                  value={form.slug}
                  onChange={(e) => update('slug', e.target.value)}
                  placeholder="contract-review"
                />
              </div>

              <div>
                <label className="form-label" htmlFor="skill-name">
                  {language === 'zh' ? '名称' : 'Name'} <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                  <input
                  id="skill-name"
                  type="text"
                  className="form-input"
                  required
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder={language === 'zh' ? '合同审查' : 'Contract Review'}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="skill-version">
                  {language === 'zh' ? '版本' : 'Version'} <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                  <input
                  id="skill-version"
                  type="text"
                  className="form-input"
                  required
                  pattern="\d+\.\d+\.\d+([\-][0-9A-Za-z.-]+)?"
                  value={form.version}
                  onChange={(e) => update('version', e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="skill-entrypoint">
                  {language === 'zh' ? '入口' : 'Entrypoint'} <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                  <input
                  id="skill-entrypoint"
                  type="text"
                  className="form-input"
                  required
                  value={form.entrypoint}
                  onChange={(e) => update('entrypoint', e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="skill-license">
                  {language === 'zh' ? '许可证' : 'License'} <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                  <input
                  id="skill-license"
                  type="text"
                  className="form-input"
                  required
                  value={form.license}
                  onChange={(e) => update('license', e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="skill-risk-level">
                  {language === 'zh' ? '风险等级' : 'Risk Level'}
                </label>
                  <select
                  id="skill-risk-level"
                  className="form-input"
                  value={form.riskLevel}
                  onChange={(e) => update('riskLevel', e.target.value)}
                >
                  <option value="low">{language === 'zh' ? '低' : 'Low'}</option>
                  <option value="medium">{language === 'zh' ? '中' : 'Medium'}</option>
                  <option value="high">{language === 'zh' ? '高' : 'High'}</option>
                  <option value="critical">{language === 'zh' ? '严重' : 'Critical'}</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label" htmlFor="skill-description">{language === 'zh' ? '描述' : 'Description'}</label>
              <textarea
                id="skill-description"
                className="form-input"
                rows={5}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
              />
            </div>

            <div style={{ marginTop: 'var(--space-4)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  id="skill-side-effects"
                  type="checkbox"
                  checked={form.sideEffects}
                  onChange={(e) => update('sideEffects', e.target.checked)}
                />
                <span style={{ fontSize: '0.875rem' }}>
                  {language === 'zh' ? '该 Skill 会产生外部副作用' : 'This skill has side effects'}
                </span>
              </label>
            </div>

            {error && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3)',
                background: 'var(--error-light)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--error)',
                fontSize: '0.875rem'
              }}>
                ❌ {language === 'zh' ? '创建失败' : 'Failed'}: {error}
              </div>
            )}

            <div style={{
              marginTop: 'var(--space-6)',
              paddingTop: 'var(--space-6)',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => router.push('/skills')}
              >
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy
                  ? (language === 'zh' ? '创建中...' : 'Creating...')
                  : (language === 'zh' ? '创建草稿' : 'Create Draft')}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
