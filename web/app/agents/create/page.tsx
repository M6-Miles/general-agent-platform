'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BarChart3, Bot, Check, Database, Globe2, Microscope, Rocket, Settings2, ShieldCheck, Sparkles, UserRound, Wrench } from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { Language } from '../../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../../lib/api';
import PlatformHeader from '../../components/PlatformHeader';
import '../../design-system.css';

const STEPS = [
  { num: 1, zh: '选择模板', en: 'Template' },
  { num: 2, zh: '基本信息', en: 'Basic info' },
  { num: 3, zh: '选择能力', en: 'Capabilities' },
  { num: 4, zh: '配置权限', en: 'Permissions' },
  { num: 5, zh: '预览发布', en: 'Review & publish' },
] as const;

const templateIcons = { custom: Sparkles, assistant: UserRound, analyst: BarChart3, researcher: Microscope } as const;
type TemplateId = keyof typeof templateIcons;

export default function CreateAgentPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [template, setTemplate] = React.useState<TemplateId>('custom');
  const [systemPrompt, setSystemPrompt] = React.useState('');
  const [model, setModel] = React.useState('gpt-4');
  const [temperature, setTemperature] = React.useState(0.7);
  const [tools, setTools] = React.useState<string[]>([]);
  const [visibility, setVisibility] = React.useState<'private' | 'workspace'>('private');
  const [allowRun, setAllowRun] = React.useState(true);

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang && ['en', 'zh', 'ja'].includes(savedLang)) setLanguage(savedLang);
  }, []);
  React.useEffect(() => { if (!token) router.push('/login'); }, [token, router]);

  const isZh = language === 'zh';
  const handleLanguageChange = (lang: Language) => { setLanguage(lang); localStorage.setItem('preferred-language', lang); };
  const validateStep = () => {
    setError('');
    if (step === 1 && !template) { setError(isZh ? '请选择一个模板' : 'Choose a template'); return false; }
    if (step === 2 && !name.trim()) { setError(isZh ? '请输入 Agent 名称' : 'Enter an agent name'); return false; }
    if (step === 3 && !model) { setError(isZh ? '请选择模型' : 'Choose a model'); return false; }
    return true;
  };
  const handleNext = () => { if (validateStep()) setStep((current) => Math.min(STEPS.length, current + 1)); };
  const toggleTool = (tool: string) => setTools((current) => current.includes(tool) ? current.filter((item) => item !== tool) : [...current, tool]);
  const handleSubmit = async () => {
    if (!token || !validateStep()) return;
    setLoading(true);
    try {
      const definition = {
        description, systemPrompt, model, temperature, tools: tools.map((tool) => ({ name: tool })),
        permissions: { visibility, allowRun }, template,
        workflow: {
          nodes: [
            { key: 'prepare', type: 'prepare', label: isZh ? '准备（1）' : 'Prepare 1', depends_on: [] },
            { key: 'model', type: 'model', label: isZh ? '模型（1）' : 'Model 1', config: { model, temperature, systemPrompt }, depends_on: ['prepare'] },
            { key: 'finalize', type: 'finalize', label: isZh ? '完成（1）' : 'Finalize 1', depends_on: ['model'] },
          ],
          edges: [{ source: 'prepare', target: 'model' }, { source: 'model', target: 'finalize' }],
        },
      };
      const result = await apiRequest<{ id: string }>(apiBaseUrl, '/api/v1/agents', token, { method: 'POST', body: JSON.stringify({ name: name.trim(), definition }) });
      router.push(result.data?.id ? `/agents/${result.data.id}` : '/agents');
    } catch (submitError) {
      console.error('Failed to create agent:', submitError);
      setError(isZh ? '创建失败，请稍后重试' : 'Creation failed. Please try again.');
    } finally { setLoading(false); }
  };

  const templates: { id: TemplateId; name: string; desc: string }[] = [
    { id: 'custom', name: isZh ? '从头开始' : 'From scratch', desc: isZh ? '创建空白 Agent，自由配置所有能力' : 'Start with a blank, fully configurable agent' },
    { id: 'assistant', name: isZh ? '客服助手' : 'Customer assistant', desc: isZh ? '处理客户咨询和常见问题' : 'Handle customer questions and support requests' },
    { id: 'analyst', name: isZh ? '数据分析助手' : 'Data analyst', desc: isZh ? '辅助分析数据并生成可视化结果' : 'Analyze data and create visual summaries' },
    { id: 'researcher', name: isZh ? '研究助手' : 'Research assistant', desc: isZh ? '整理资料、文献和研究结论' : 'Organize sources, notes, and findings' },
  ];

  return <div className="agent-create-page" style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
    <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="agents" />
    <div className="wizard-stepper" style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
      <div className="platform-container" style={{ minHeight: 0, padding: '20px 32px', overflowX: 'auto' }}><div style={{ display: 'flex', alignItems: 'center', minWidth: 680 }}>
        {STEPS.map((item, index) => <React.Fragment key={item.num}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
            <div aria-current={step === item.num ? 'step' : undefined} style={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', background: step >= item.num ? 'var(--primary)' : 'var(--gray-200)', color: step >= item.num ? 'white' : 'var(--text-tertiary)', fontWeight: 700 }}>{step > item.num ? <Check size={16} aria-hidden="true" /> : item.num}</div>
            <span style={{ fontSize: 14, fontWeight: step === item.num ? 700 : 500, color: step >= item.num ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{isZh ? item.zh : item.en}</span>
          </div>
          {index < STEPS.length - 1 && <div style={{ flex: 1, minWidth: 32, height: 2, margin: '0 12px', background: step > item.num ? 'var(--primary)' : 'var(--gray-200)' }} />}
        </React.Fragment>)}
      </div></div>
    </div>
    <main className="platform-container wizard-content" style={{ paddingTop: 40, paddingBottom: 48 }}><div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header" style={{ textAlign: 'center', marginBottom: 28 }}><p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>{isZh ? `步骤 ${step} / ${STEPS.length}` : `Step ${step} of ${STEPS.length}`}</p><h1 className="page-title">{isZh ? STEPS[step - 1].zh : STEPS[step - 1].en}</h1><p className="page-subtitle">{isZh ? '按步骤完成配置，最后确认后发布。' : 'Complete each step, then review and publish your agent.'}</p></div>
      {error && <div role="alert" style={{ maxWidth: 720, margin: '0 auto 20px', padding: '12px 16px', border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 8 }}>{error}</div>}
      {step === 1 && <section aria-label={isZh ? '选择模板' : 'Choose template'}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>{templates.map((item) => { const Icon = templateIcons[item.id]; const selected = template === item.id; return <button key={item.id} type="button" onClick={() => setTemplate(item.id)} aria-pressed={selected} style={{ display: 'block', width: '100%', minHeight: 150, textAlign: 'left', padding: 22, borderRadius: 10, border: selected ? '2px solid var(--primary)' : '1px solid var(--border)', background: 'white', boxShadow: selected ? '0 8px 24px rgba(79,70,229,.12)' : 'var(--shadow-sm)', cursor: 'pointer', overflowWrap: 'anywhere' }}><Icon size={26} color={selected ? 'var(--primary)' : 'var(--text-secondary)'} aria-hidden="true" /><h2 style={{ fontSize: 17, lineHeight: 1.35, margin: '14px 0 6px', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{item.name}</h2><p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{item.desc}</p></button>; })}</div><div style={{ maxWidth: 680, margin: '24px auto 0', background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}><div style={{ display: 'grid', gap: 16 }}><div><label htmlFor="agent-name" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>{isZh ? 'Agent 名称' : 'Agent name'} <span style={{ color: 'var(--error)' }}>*</span></label><input id="agent-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={isZh ? '输入 Agent 名称（可在下一步继续完善）' : 'Enter an agent name'} className="form-input" /></div><div><label htmlFor="agent-description" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>{isZh ? '描述' : 'Description'}</label><textarea id="agent-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={isZh ? '简要说明 Agent 的用途' : 'Briefly describe the purpose'} rows={3} className="form-input" style={{ resize: 'vertical' }} /></div></div></div></section>}
      {step === 2 && <section style={{ maxWidth: 680, margin: '0 auto', background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 28 }}><div style={{ display: 'grid', gap: 20 }}>
        <div><label htmlFor="agent-name" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>{isZh ? 'Agent 名称' : 'Agent name'} <span style={{ color: 'var(--error)' }}>*</span></label><input id="agent-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={isZh ? '输入 Agent 名称' : 'Enter agent name'} className="form-input" autoFocus /></div>
        <div><label htmlFor="agent-description" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>{isZh ? '描述' : 'Description'}</label><textarea id="agent-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={isZh ? '说明 Agent 的用途和适用场景' : 'Describe the purpose and use cases'} rows={4} className="form-input" style={{ resize: 'vertical' }} /></div>
        <div><label htmlFor="system-prompt" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>{isZh ? '系统提示词' : 'System prompt'}</label><textarea id="system-prompt" value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} placeholder={isZh ? '定义 Agent 的角色、边界和输出格式' : 'Define the role, boundaries, and output format'} rows={7} className="form-input" style={{ resize: 'vertical', fontFamily: 'var(--font-mono)' }} /></div>
      </div></section>}
      {step === 3 && <section style={{ maxWidth: 680, margin: '0 auto', background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 28 }}><div style={{ display: 'grid', gap: 22 }}>
        <div><label htmlFor="agent-model" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>{isZh ? '模型' : 'Model'}</label><select id="agent-model" value={model} onChange={(event) => setModel(event.target.value)} className="form-input"><option value="deepseek-chat">DeepSeek Chat</option><option value="deepseek-reasoner">DeepSeek Reasoner</option><option value="gpt-4">GPT-4</option><option value="gpt-4o">GPT-4o</option><option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option></select><p style={{ margin: '6px 0 0', color: 'var(--text-tertiary)', fontSize: 12 }}>{isZh ? '模型服务由项目 .env 中的 API 配置决定。' : 'The model provider and API are configured in the project .env file.'}</p></div>
        <div><label htmlFor="agent-temperature" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: 8 }}><span>{isZh ? '创造性（温度）' : 'Creativity (temperature)'}</span><output>{temperature.toFixed(1)}</output></label><input id="agent-temperature" type="range" min="0" max="1" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} /></div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontWeight: 600, marginBottom: 10 }}>{isZh ? '启用工具' : 'Enabled tools'}</legend><div style={{ display: 'grid', gap: 10 }}>{[['web_search', isZh ? '联网搜索' : 'Web search', Globe2], ['database', isZh ? '数据库查询' : 'Database query', Database], ['workflow', isZh ? '工作流调用' : 'Workflow invocation', Wrench]].map(([id, label, Icon]) => <label key={String(id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}><input type="checkbox" checked={tools.includes(String(id))} onChange={() => toggleTool(String(id))} /><Icon size={18} aria-hidden="true" /><span>{String(label)}</span></label>)}</div></fieldset>
      </div></section>}
      {step === 4 && <section style={{ maxWidth: 680, margin: '0 auto', background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 28 }}><div style={{ display: 'grid', gap: 22 }}>
        <div><label htmlFor="agent-visibility" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>{isZh ? '可见范围' : 'Visibility'}</label><select id="agent-visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as 'private' | 'workspace')} className="form-input"><option value="private">{isZh ? '仅自己可见' : 'Private'}</option><option value="workspace">{isZh ? '工作区成员可见' : 'Workspace members'}</option></select></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}><input type="checkbox" checked={allowRun} onChange={(event) => setAllowRun(event.target.checked)} /><ShieldCheck size={18} aria-hidden="true" /><span>{isZh ? '允许工作区成员运行此 Agent' : 'Allow workspace members to run this agent'}</span></label>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, background: 'var(--gray-50)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 14 }}><Settings2 size={20} aria-hidden="true" /><span>{isZh ? '发布后仍可在 Agent 详情页调整权限和版本。' : 'Permissions and versions can be adjusted after publishing.'}</span></div>
      </div></section>}
      {step === 5 && <section style={{ maxWidth: 760, margin: '0 auto', background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 28 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}><Bot size={28} color="var(--primary)" aria-hidden="true" /><div><h2 style={{ margin: 0, fontSize: 20 }}>{name || (isZh ? '未命名 Agent' : 'Untitled agent')}</h2><p style={{ margin: '5px 0 0', color: 'var(--text-secondary)' }}>{description || (isZh ? '暂无描述' : 'No description')}</p></div></div><dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, margin: '22px 0 0' }}><div><dt style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{isZh ? '模板' : 'Template'}</dt><dd style={{ margin: '5px 0 0', fontWeight: 600 }}>{templates.find((item) => item.id === template)?.name}</dd></div><div><dt style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{isZh ? '模型' : 'Model'}</dt><dd style={{ margin: '5px 0 0', fontWeight: 600 }}>{model}</dd></div><div><dt style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{isZh ? '工具' : 'Tools'}</dt><dd style={{ margin: '5px 0 0', fontWeight: 600 }}>{tools.length || (isZh ? '未启用' : 'None')}</dd></div><div><dt style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{isZh ? '权限' : 'Access'}</dt><dd style={{ margin: '5px 0 0', fontWeight: 600 }}>{visibility === 'private' ? (isZh ? '私有' : 'Private') : (isZh ? '工作区' : 'Workspace')}</dd></div></dl></section>}
      <div className="wizard-actions" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}><button type="button" className="btn btn-secondary" onClick={() => step > 1 ? setStep((current) => current - 1) : router.push('/agents')}><ArrowLeft size={17} aria-hidden="true" />{step === 1 ? (isZh ? '取消' : 'Cancel') : (isZh ? '上一步' : 'Previous')}</button>{step < STEPS.length ? <button type="button" className="btn btn-primary" onClick={handleNext}>{isZh ? '下一步' : 'Next'}<ArrowRight size={17} aria-hidden="true" /></button> : <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}><Rocket size={17} aria-hidden="true" />{loading ? (isZh ? '创建中...' : 'Creating...') : (isZh ? '发布 Agent' : 'Publish agent')}</button>}</div>
    </div></main>
  </div>;
}
