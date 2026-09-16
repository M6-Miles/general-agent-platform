'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { Language } from '../../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../../lib/api';
import PlatformHeader from '../../components/PlatformHeader';
import WorkflowEditor from '../../components/WorkflowEditor';
import { useNotifier } from '../../components/NotificationProvider';
import '../../design-system.css';

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
}

export default function CreateWorkflowPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const notify = useNotifier();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [loading, setLoading] = React.useState(false);
  const [showNameDialog, setShowNameDialog] = React.useState(true);

  // Form state
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  // Initial workflow with start and end nodes
  const [initialNodes] = React.useState<WorkflowNode[]>([
    { id: 'start-1', type: 'start', label: language === 'zh' ? '开始' : 'Start' },
    { id: 'end-1', type: 'end', label: language === 'zh' ? '结束' : 'End' }
  ]);
  const [initialEdges] = React.useState<{ source: string; target: string }[]>([
    { source: 'start-1', target: 'end-1' }
  ]);

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

  const handleSaveWorkflow = async (nodes: WorkflowNode[], edges: { source: string; target: string }[]) => {
    if (!token || !name) {
      notify(language === 'zh' ? '请先输入工作流名称' : 'Please enter workflow name first', 'error');
      setShowNameDialog(true);
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest<{ id: string }>(apiBaseUrl, '/api/v1/workflows', token, {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          nodes,
          edges
        })
      });

      // 创建成功后跳转到详情页
      if (result.data?.id) {
        router.push(`/workflows/${result.data.id}`);
      } else {
        router.push('/workflows');
      }
    } catch (error) {
      console.error('Failed to create workflow:', error);
      notify(language === 'zh' ? '创建失败，请检查节点配置' : 'Failed to create workflow, please check node configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmName = () => {
    if (name.trim()) {
      setShowNameDialog(false);
    } else {
      notify(language === 'zh' ? '请输入工作流名称' : 'Please enter workflow name', 'error');
    }
  };

  return (
    <div>
      <PlatformHeader
        language={language}
        onLanguageChange={handleLanguageChange}
        activePage="workflows"
      />

      {/* Main Content */}
      <main className="platform-container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
            <h1 className="page-title">{language === 'zh' ? '创建工作流' : 'Create Workflow'}</h1>
            <p className="page-subtitle">
              {language === 'zh'
                ? '使用可视化编辑器设计工作流，拖拽节点、连接关系，构建复杂的业务流程'
                : 'Design workflows using visual editor, drag nodes, connect relationships, and build complex business processes'}
            </p>
          </div>

          {/* Name Dialog */}
          {showNameDialog && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }} role="dialog" aria-modal="true" aria-labelledby="workflow-dialog-title">
              <div style={{
                background: 'white',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-8)',
                maxWidth: '500px',
                width: '90%',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}>
                <h2 id="workflow-dialog-title" style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
                  {language === 'zh' ? '工作流基本信息' : 'Workflow Basic Info'}
                </h2>

                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <label htmlFor="workflow-name" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 'var(--space-2)' }}>
                    {language === 'zh' ? '名称' : 'Name'} <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <input
                    id="workflow-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={language === 'zh' ? '输入工作流名称' : 'Enter workflow name'}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && name.trim()) {
                        handleConfirmName();
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: 'var(--space-3)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.9375rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <label htmlFor="workflow-description" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 'var(--space-2)' }}>
                    {language === 'zh' ? '描述' : 'Description'}
                  </label>
                  <textarea
                    id="workflow-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={language === 'zh' ? '简要描述工作流的用途' : 'Briefly describe the workflow purpose'}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: 'var(--space-3)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.9375rem',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => router.push('/workflows')}
                    className="btn btn-secondary"
                  >
                    {language === 'zh' ? '取消' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleConfirmName}
                    className="btn btn-primary"
                    disabled={!name.trim()}
                  >
                    {language === 'zh' ? '确认并开始设计' : 'Confirm and start'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Workflow Editor */}
          {!showNameDialog && (
            <>
              <div style={{
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-4)',
                marginBottom: 'var(--space-4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                    {name}
                  </h3>
                  {description && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowNameDialog(true)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.875rem' }}
                >
                  {language === 'zh' ? '编辑信息' : 'Edit Info'}
                </button>
              </div>

              <WorkflowEditor
                initialNodes={initialNodes}
                initialEdges={initialEdges}
                onSave={handleSaveWorkflow}
                language={language}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
