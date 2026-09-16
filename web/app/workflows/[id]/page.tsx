'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { Language } from '../../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../../lib/api';
import { errorMessage } from '../../../lib/errors';
import PlatformHeader from '../../components/PlatformHeader';
import { useConfirm, useNotifier } from '../../components/NotificationProvider';
import ErrorState from '../../components/ErrorState';
import '../../design-system.css';

// 懒加载 ReactFlow 组件（减少首屏加载）
const WorkflowEditor = dynamic(() => import('../../components/WorkflowEditor'), {
  loading: () => (
    <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
      <div className="spinner"></div>
      <p style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)' }}>加载编辑器...</p>
    </div>
  ),
  ssr: false
});

type WorkflowNode = {
  id: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
};

type WorkflowEdge = {
  source: string;
  target: string;
  condition?: string;
};

type WorkflowDefinition = {
  id: string;
  name: string;
  description: string;
  status: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created_at: string;
  updated_at: string;
};

type WorkflowInstance = {
  id: string;
  workflow_id: string;
  status: string;
  created_at: string;
};

export default function WorkflowDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const notify = useNotifier();
  const confirm = useConfirm();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [workflow, setWorkflow] = React.useState<WorkflowDefinition | null>(null);
  const [instances, setInstances] = React.useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'overview' | 'editor' | 'instances' | 'definition'>('overview');
  const [question, setQuestion] = React.useState('');
  const [executing, setExecuting] = React.useState(false);

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  React.useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadWorkflow();
  }, [token, params.id, router]);

  const loadWorkflow = async () => {
    if (!token || !params.id) return;
    setLoading(true);
    setError('');
    try {
      const workflowResult = await apiRequest<WorkflowDefinition>(
        apiBaseUrl,
        `/api/v1/workflows/${params.id}`,
        token
      );
      setWorkflow(workflowResult.data);

      const instancesResult = await apiRequest<WorkflowInstance[]>(
        apiBaseUrl,
        `/api/v1/workflow-instances?workflow_id=${params.id}`,
        token
      );
      setInstances(instancesResult.data || []);
    } catch (error) {
      console.error('Failed to load workflow:', error);
      setWorkflow(null);
      setError(errorMessage(error, language === 'zh' ? '加载工作流失败' : 'Failed to load workflow'));
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!token || !params.id || !workflow) return;
    const prompt = question.trim();
    if (!prompt) {
      notify(language === 'zh' ? '请先输入要交给工作流的问题' : 'Enter a question before running', 'error');
      document.getElementById('workflow-question')?.focus();
      return;
    }
    setExecuting(true);
    try {
      if (workflow.status !== 'published') {
        await apiRequest(apiBaseUrl, `/api/v1/agents/${params.id}/publish`, token, { method: 'POST' });
      }
      const result = await apiRequest<{ id: string; run_id?: string | null }>(
        apiBaseUrl,
        '/api/v1/workflow-instances',
        token,
        {
          method: 'POST',
          body: JSON.stringify({ workflow_id: params.id, input: { prompt } })
        }
      );
      if (result.data.run_id) {
        await apiRequest(apiBaseUrl, `/api/v1/runs/${result.data.run_id}/execute?async=true`, token, { method: 'POST' });
      }
      notify(language === 'zh' ? '工作流已启动执行' : 'Workflow execution started', 'success');
      router.push(`/workflow-instances/${result.data.id}`);
    } catch (error: unknown) {
      notify(language === 'zh' ? `执行失败: ${errorMessage(error)}` : `Failed: ${errorMessage(error)}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const handleSave = async (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
    if (!token || !params.id) return;
    try {
      await apiRequest(
        apiBaseUrl,
        `/api/v1/workflows/${params.id}`,
        token,
        {
          method: 'PUT',
          headers: { 'If-Match': String(workflow?.version ?? '') },
          body: JSON.stringify({ nodes, edges })
        }
      );
      notify(language === 'zh' ? '工作流已保存' : 'Workflow saved', 'success');
      await loadWorkflow();
    } catch (error: unknown) {
      notify(language === 'zh' ? `保存失败: ${errorMessage(error)}` : `Save failed: ${errorMessage(error)}`, 'error');
    }
  };

  const handleDuplicate = async () => {
    if (!token || !params.id || !(await confirm(language === 'zh' ? '确定要复制此工作流吗？' : 'Duplicate this workflow?', language === 'zh' ? '复制工作流' : 'Duplicate workflow'))) return;
    try {
      const result = await apiRequest<{ id: string }>(
        apiBaseUrl,
        `/api/v1/workflows/${params.id}/duplicate`,
        token,
        { method: 'POST' }
      );
      notify(language === 'zh' ? '工作流已复制' : 'Workflow duplicated', 'success');
      router.push(`/workflows/${result.data.id}`);
    } catch (error: unknown) {
      notify(language === 'zh' ? `复制失败: ${errorMessage(error)}` : `Failed: ${errorMessage(error)}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!token || !params.id || !(await confirm(language === 'zh' ? '确定要删除此工作流吗？此操作不可恢复。' : 'Delete this workflow? This cannot be undone.', language === 'zh' ? '删除工作流' : 'Delete workflow'))) return;
    try {
      await apiRequest(apiBaseUrl, `/api/v1/workflows/${params.id}`, token, { method: 'DELETE' });
      notify(language === 'zh' ? '工作流已删除' : 'Workflow deleted', 'success');
      router.push('/workflows');
    } catch (error: unknown) {
      notify(language === 'zh' ? `删除失败: ${errorMessage(error)}` : `Failed: ${errorMessage(error)}`, 'error');
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  if (loading) {
    return (
      <div>
        <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="workflows" />
        <main className="platform-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>{language === 'zh' ? '加载中...' : 'Loading...'}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error && !workflow) {
    return (
      <div>
        <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="workflows" />
        <main className="platform-container">
          <ErrorState state="error" error={error} onRetry={() => void loadWorkflow()} />
          <button className="btn btn-secondary" onClick={() => router.push('/workflows')}>{language === 'zh' ? '返回列表' : 'Back to List'}</button>
        </main>
      </div>
    );
  }

  if (!workflow) {
    return <div><PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="workflows" /><main className="platform-container"><ErrorState state="empty" emptyTitle={language === 'zh' ? '工作流不存在' : 'Workflow Not Found'} emptyAction={<button className="btn btn-secondary" onClick={() => router.push('/workflows')}>{language === 'zh' ? '返回列表' : 'Back to List'}</button>} /></main></div>;
  }

  return (
    <div>
      <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="workflows" />

      <main className="platform-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              <span className="gradient">{workflow.name}</span>
            </h1>
            <p className="page-subtitle">{workflow.description || (language === 'zh' ? '暂无描述' : 'No description')}</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-primary" onClick={() => document.getElementById('workflow-question')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
              {language === 'zh' ? '▶ 填写问题' : '▶ Enter Question'}
            </button>
            <button className="btn btn-secondary" onClick={handleDuplicate}>
              {language === 'zh' ? '复制' : 'Duplicate'}
            </button>
            <button className="btn btn-secondary" onClick={handleDelete} style={{ color: 'var(--error)' }}>
              {language === 'zh' ? '删除' : 'Delete'}
            </button>
          </div>
        </div>

        <form className="card" onSubmit={handleExecute} style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
            <div>
              <label htmlFor="workflow-question" style={{ display: 'block', fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                {language === 'zh' ? '运行问题' : 'Run input'}
              </label>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {language === 'zh' ? '输入要交给这个工作流处理的问题。' : 'Enter the question this workflow should process.'}
              </p>
            </div>
            <span className={`badge ${workflow.status}`}>{workflow.status === 'published' ? (language === 'zh' ? '已发布' : 'Published') : (language === 'zh' ? '草稿' : 'Draft')}</span>
          </div>
          <textarea
            id="workflow-question"
            className="ui-textarea"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={4}
            placeholder={language === 'zh' ? '例如：请介绍这个项目的技术架构和主要功能' : 'For example: Explain this project architecture and key features'}
            disabled={executing}
            style={{ width: '100%', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
            <button className="btn btn-primary" type="submit" disabled={executing || !question.trim()}>
              {executing ? (language === 'zh' ? '正在启动...' : 'Starting...') : workflow.status === 'published' ? (language === 'zh' ? '执行工作流' : 'Run Workflow') : (language === 'zh' ? '发布并执行' : 'Publish & Run')}
            </button>
          </div>
        </form>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
            <button
              className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
              style={{ padding: 'var(--space-4) 0', borderBottom: activeTab === 'overview' ? '2px solid var(--primary)' : 'none' }}
              onClick={() => setActiveTab('overview')}
            >
              {language === 'zh' ? '概览' : 'Overview'}
            </button>
            <button
              className={`nav-link ${activeTab === 'editor' ? 'active' : ''}`}
              style={{ padding: 'var(--space-4) 0', borderBottom: activeTab === 'editor' ? '2px solid var(--primary)' : 'none' }}
              onClick={() => setActiveTab('editor')}
            >
              {language === 'zh' ? '可视化编辑器' : 'Visual Editor'}
            </button>
            <button
              className={`nav-link ${activeTab === 'instances' ? 'active' : ''}`}
              style={{ padding: 'var(--space-4) 0', borderBottom: activeTab === 'instances' ? '2px solid var(--primary)' : 'none' }}
              onClick={() => setActiveTab('instances')}
            >
              {language === 'zh' ? `执行历史 (${instances.length})` : `Instances (${instances.length})`}
            </button>
            <button
              className={`nav-link ${activeTab === 'definition' ? 'active' : ''}`}
              style={{ padding: 'var(--space-4) 0', borderBottom: activeTab === 'definition' ? '2px solid var(--primary)' : 'none' }}
              onClick={() => setActiveTab('definition')}
            >
              {language === 'zh' ? '工作流定义' : 'Definition'}
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-6)' }}>
              {language === 'zh' ? '工作流结构' : 'Workflow Structure'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                  {language === 'zh' ? '节点' : 'Nodes'} ({workflow.nodes.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {workflow.nodes.map((node) => (
                    <div key={node.id} style={{ padding: 'var(--space-4)', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <span style={{ fontSize: '1.5rem' }}>
                          {node.type === 'start' ? '🟢' : node.type === 'end' ? '🔴' : node.type === 'agent' ? '🤖' : '⚙️'}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{node.label}</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {node.type} · ID: {node.id}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                  {language === 'zh' ? '连线' : 'Edges'} ({workflow.edges.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {workflow.edges.map((edge, index) => (
                    <div key={index} style={{ padding: 'var(--space-3)', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                      <strong>{edge.source}</strong> → <strong>{edge.target}</strong>
                      {edge.condition && <span style={{ marginLeft: 'var(--space-2)', color: 'var(--text-secondary)' }}>
                        (条件: {edge.condition})
                      </span>}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                  {language === 'zh' ? '元数据' : 'Metadata'}
                </h3>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div><strong>{language === 'zh' ? '创建时间' : 'Created'}:</strong> {new Date(workflow.created_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}</div>
                  <div><strong>{language === 'zh' ? '更新时间' : 'Updated'}:</strong> {new Date(workflow.updated_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Visual Editor Tab */}
        {activeTab === 'editor' && (
          <div>
            <WorkflowEditor
              initialNodes={workflow.nodes}
              initialEdges={workflow.edges}
              onSave={handleSave}
              language={language}
            />
          </div>
        )}

        {/* Instances Tab */}
        {activeTab === 'instances' && (
          <div>
            {instances.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3 className="empty-title">{language === 'zh' ? '还没有执行记录' : 'No Executions Yet'}</h3>
                <p className="empty-description">{language === 'zh' ? '点击上方"执行"按钮开始运行此工作流' : 'Click "Execute" button above to run this workflow'}</p>
              </div>
            ) : (
              <div className="cards-grid">
                {instances.map((instance) => (
                  <div key={instance.id} className="entity-card" onClick={() => router.push(`/workflow-instances/${instance.id}`)}>
                    <div className="entity-icon">
                      {instance.status === 'completed' ? '✅' : instance.status === 'failed' ? '❌' : '⏳'}
                    </div>
                    <h3 className="entity-name">{instance.id.substring(0, 8)}...</h3>
                    <div className="entity-footer">
                      <span className={`entity-status ${instance.status}`}>{instance.status}</span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                        {new Date(instance.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Definition Tab */}
        {activeTab === 'definition' && (
          <div className="card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-6)' }}>
              {language === 'zh' ? 'JSON 定义' : 'JSON Definition'}
            </h2>
            <pre style={{
              background: 'var(--gray-900)',
              color: '#d4d4d4',
              padding: 'var(--space-6)',
              borderRadius: 'var(--radius-md)',
              overflow: 'auto',
              fontSize: '0.875rem',
              lineHeight: 1.6
            }}>
              {JSON.stringify(workflow, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
