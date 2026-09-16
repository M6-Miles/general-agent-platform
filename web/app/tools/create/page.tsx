'use client';

import {ArrowLeft, Save} from 'lucide-react';
import {useRouter} from 'next/navigation';
import React from 'react';
import {apiBaseUrl, apiRequest} from '../../../lib/api';
import {Language} from '../../../lib/i18n';
import PlatformHeader from '../../components/PlatformHeader';
import {useAuth} from '../../components/AuthProvider';
import {useNotifier} from '../../components/NotificationProvider';
import ToolConfigurationForm, {
  emptyToolConfiguration,
  parseToolConfiguration,
} from '../ToolConfigurationForm';

type CreatedTool = {id: string};

export default function CreateToolPage() {
  const router = useRouter();
  const {token, ready} = useAuth();
  const notify = useNotifier();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [form, setForm] = React.useState(emptyToolConfiguration);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  React.useEffect(() => {
    if (ready && !token) router.replace('/login');
  }, [ready, token, router]);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    const parsed = parseToolConfiguration(form, language);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<CreatedTool>(apiBaseUrl, '/api/v1/tools', token, {
        method: 'POST',
        body: JSON.stringify({...parsed.data, manifest: {}, capabilities: {}}),
      });
      notify(language === 'zh' ? '工具已注册，初始版本为 v1' : 'Tool registered as v1', 'success');
      router.push(`/tools/${result.data.id}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      notify(language === 'zh' ? `注册工具失败：${message}` : `Failed to register tool: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="tools" />
      <main className="platform-container tool-create-page">
        <div className="page-header">
          <h1 className="page-title">{language === 'zh' ? '注册工具' : 'Register Tool'}</h1>
          <p className="page-subtitle">{language === 'zh' ? '定义执行器、数据契约和运行风险，注册后可由 Agent 调用。' : 'Define the executor, data contract, and runtime risk for Agent use.'}</p>
        </div>
        <form className="tool-create-shell" onSubmit={handleSubmit} noValidate>
          <div className="tool-panel-heading">
            <div><h2>{language === 'zh' ? '工具配置' : 'Tool configuration'}</h2><p>{language === 'zh' ? '必填项用于识别和执行工具，JSON Schema 用于校验每次调用。' : 'Required fields identify and execute the tool; JSON Schema validates each call.'}</p></div>
          </div>
          <ToolConfigurationForm value={form} onChange={setForm} language={language} disabled={loading} />
          {error && <p className="tool-form-error" role="alert">{error}</p>}
          <div className="tool-panel-actions">
            <button className="secondary-button icon-text-button" type="button" onClick={() => router.push('/tools')} disabled={loading}><ArrowLeft size={16} />{language === 'zh' ? '返回列表' : 'Back'}</button>
            <button className="primary-button icon-text-button" type="submit" disabled={loading}><Save size={16} />{loading ? (language === 'zh' ? '注册中...' : 'Registering...') : (language === 'zh' ? '注册工具' : 'Register tool')}</button>
          </div>
        </form>
      </main>
    </div>
  );
}
