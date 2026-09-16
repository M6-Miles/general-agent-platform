'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { Language } from '../../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../../lib/api';
import { errorMessage } from '../../../lib/errors';
import PlatformHeader from '../../components/PlatformHeader';
import { useConfirm, useNotifier } from '../../components/NotificationProvider';
import ErrorState from '../../components/ErrorState';
import '../../design-system.css';

type Document = {
  id: string;
  filename: string;
  content_type: string;
  status: string;
  created_at: string;
  chunks_count: number;
};

type KnowledgeBase = {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
  document_count: number;
  documents: Document[];
};

type QueryResult = {
  chunk_id: string;
  document_id: string;
  score: number;
  content: string;
  position: number;
};

export default function KnowledgeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const notify = useNotifier();
  const confirm = useConfirm();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [knowledgeBase, setKnowledgeBase] = React.useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [querying, setQuerying] = React.useState(false);
  const [queryText, setQueryText] = React.useState('');
  const [queryResults, setQueryResults] = React.useState<QueryResult[]>([]);
  const [activeTab, setActiveTab] = React.useState<'documents' | 'query'>('documents');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  React.useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadKnowledgeBase();
  }, [token, params.id, router]);

  const loadKnowledgeBase = async () => {
    if (!token || !params.id) return;
    setLoading(true);
    setLoadError('');
    try {
      const result = await apiRequest<KnowledgeBase>(
        apiBaseUrl,
        `/api/v1/knowledge-bases/${params.id}`,
        token
      );
      setKnowledgeBase(result.data);
    } catch (error) {
      console.error('Failed to load knowledge base:', error);
      setKnowledgeBase(null);
      setLoadError(errorMessage(error, language === 'zh' ? '加载知识库失败' : 'Failed to load knowledge base'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !token || !params.id) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${apiBaseUrl}/api/v1/knowledge-bases/${params.id}/documents/upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      notify(language === 'zh' ? '文档上传成功！正在处理...' : 'Document uploaded! Processing...', 'success');
      await loadKnowledgeBase();
    } catch (error: unknown) {
      notify(language === 'zh' ? `上传失败: ${errorMessage(error)}` : `Upload failed: ${errorMessage(error)}`, 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleQuery = async () => {
    if (!token || !params.id || !queryText.trim()) return;

    setQuerying(true);
    try {
      const result = await apiRequest<{ results: QueryResult[] }>(
        apiBaseUrl,
        `/api/v1/knowledge-bases/${params.id}/query`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            query: queryText.trim(),
            top_k: 5,
            strategy: 'hybrid'
          })
        }
      );
      setQueryResults(result.data.results || []);
    } catch (error: unknown) {
      notify(language === 'zh' ? `查询失败: ${errorMessage(error)}` : `Query failed: ${errorMessage(error)}`, 'error');
    } finally {
      setQuerying(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!token || !params.id || !(await confirm(language === 'zh' ? '确定要删除此文档吗？' : 'Delete this document?', language === 'zh' ? '删除文档' : 'Delete document'))) return;

    try {
      await apiRequest(
        apiBaseUrl,
        `/api/v1/knowledge-bases/${params.id}/documents/${documentId}`,
        token,
        { method: 'DELETE' }
      );
      notify(language === 'zh' ? '文档已删除' : 'Document deleted', 'success');
      await loadKnowledgeBase();
    } catch (error: unknown) {
      notify(language === 'zh' ? `删除失败: ${errorMessage(error)}` : `Failed: ${errorMessage(error)}`, 'error');
    }
  };

  const handleDeleteKnowledgeBase = async () => {
    if (!token || !params.id || !(await confirm(language === 'zh' ? '确定要删除整个知识库吗？此操作不可恢复。' : 'Delete entire knowledge base? This cannot be undone.', language === 'zh' ? '删除知识库' : 'Delete knowledge base'))) return;

    try {
      await apiRequest(apiBaseUrl, `/api/v1/knowledge-bases/${params.id}`, token, { method: 'DELETE' });
      notify(language === 'zh' ? '知识库已删除' : 'Knowledge base deleted', 'success');
      router.push('/knowledge');
    } catch (error: unknown) {
      notify(language === 'zh' ? `删除失败: ${errorMessage(error)}` : `Failed: ${errorMessage(error)}`, 'error');
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      processed: { color: 'var(--success)', text: language === 'zh' ? '已处理' : 'Processed' },
      processing: { color: 'var(--warning)', text: language === 'zh' ? '处理中' : 'Processing' },
      failed: { color: 'var(--error)', text: language === 'zh' ? '失败' : 'Failed' }
    };
    const statusInfo = statusMap[status] || { color: 'var(--text-secondary)', text: status };
    return (
      <span style={{ padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', background: statusInfo.color + '20', color: statusInfo.color, fontSize: '0.75rem', fontWeight: 600 }}>
        {statusInfo.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div>
        <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="knowledge" />
        <main className="platform-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>{language === 'zh' ? '加载中...' : 'Loading...'}</p>
          </div>
        </main>
      </div>
    );
  }

  if (loadError && !knowledgeBase) {
    return (
      <div>
        <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="knowledge" />
        <main className="platform-container">
          <ErrorState state="error" error={loadError} onRetry={() => void loadKnowledgeBase()} />
          <button className="btn btn-secondary" onClick={() => router.push('/knowledge')}>{language === 'zh' ? '返回列表' : 'Back to List'}</button>
        </main>
      </div>
    );
  }

  if (!knowledgeBase) {
    return <div><PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="knowledge" /><main className="platform-container"><ErrorState state="empty" emptyTitle={language === 'zh' ? '知识库不存在' : 'Knowledge Base Not Found'} emptyAction={<button className="btn btn-secondary" onClick={() => router.push('/knowledge')}>{language === 'zh' ? '返回列表' : 'Back to List'}</button>} /></main></div>;
  }

  return (
    <div>
      <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="knowledge" />

      <main className="platform-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              <span className="gradient">{knowledgeBase.name}</span>
            </h1>
            <p className="page-subtitle">
              {knowledgeBase.description || (language === 'zh' ? '暂无描述' : 'No description')}
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
              Slug: {knowledgeBase.slug} · {language === 'zh' ? '文档数' : 'Documents'}: {knowledgeBase.document_count}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.docx,.xlsx"
              style={{ display: 'none' }}
              onChange={handleUpload}
              disabled={uploading}
            />
            <button
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (language === 'zh' ? '上传中...' : 'Uploading...') : (language === 'zh' ? '📤 上传文档' : '📤 Upload Document')}
            </button>
            <button className="btn btn-secondary" onClick={handleDeleteKnowledgeBase} style={{ color: 'var(--error)' }}>
              {language === 'zh' ? '删除知识库' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
            <button
              className={`nav-link ${activeTab === 'documents' ? 'active' : ''}`}
              style={{ padding: 'var(--space-4) 0', borderBottom: activeTab === 'documents' ? '2px solid var(--primary)' : 'none' }}
              onClick={() => setActiveTab('documents')}
            >
              {language === 'zh' ? `文档列表 (${knowledgeBase.documents.length})` : `Documents (${knowledgeBase.documents.length})`}
            </button>
            <button
              className={`nav-link ${activeTab === 'query' ? 'active' : ''}`}
              style={{ padding: 'var(--space-4) 0', borderBottom: activeTab === 'query' ? '2px solid var(--primary)' : 'none' }}
              onClick={() => setActiveTab('query')}
            >
              {language === 'zh' ? '检索测试' : 'Query Test'}
            </button>
          </div>
        </div>

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div>
            {knowledgeBase.documents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h3 className="empty-title">{language === 'zh' ? '还没有文档' : 'No Documents Yet'}</h3>
                <p className="empty-description">
                  {language === 'zh' ? '点击上方"上传文档"按钮添加文档到知识库' : 'Click "Upload Document" button above to add documents'}
                </p>
              </div>
            ) : (
              <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>
                        {language === 'zh' ? '文件名' : 'Filename'}
                      </th>
                      <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>
                        {language === 'zh' ? '类型' : 'Type'}
                      </th>
                      <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>
                        {language === 'zh' ? '状态' : 'Status'}
                      </th>
                      <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>
                        {language === 'zh' ? '分块数' : 'Chunks'}
                      </th>
                      <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>
                        {language === 'zh' ? '上传时间' : 'Uploaded'}
                      </th>
                      <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>
                        {language === 'zh' ? '操作' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {knowledgeBase.documents.map((doc) => (
                      <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 'var(--space-3)', fontSize: '0.875rem' }}>{doc.filename}</td>
                        <td style={{ padding: 'var(--space-3)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          {doc.content_type}
                        </td>
                        <td style={{ padding: 'var(--space-3)' }}>{getStatusBadge(doc.status)}</td>
                        <td style={{ padding: 'var(--space-3)', fontSize: '0.875rem' }}>{doc.chunks_count || 0}</td>
                        <td style={{ padding: 'var(--space-3)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          {new Date(doc.created_at).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US')}
                        </td>
                        <td style={{ padding: 'var(--space-3)' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', color: 'var(--error)' }}
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            {language === 'zh' ? '删除' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Query Tab */}
        {activeTab === 'query' && (
          <div className="card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-6)' }}>
              {language === 'zh' ? '检索测试' : 'Retrieval Test'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="form-label" htmlFor="knowledge-query">
                  {language === 'zh' ? '查询内容' : 'Query Text'}
                </label>
                <textarea
                  id="knowledge-query"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder={language === 'zh' ? '输入要检索的问题或关键词...' : 'Enter query or keywords...'}
                  className="form-input"
                  rows={3}
                />
              </div>
              <div>
                <button
                  className="btn btn-primary"
                  onClick={handleQuery}
                  disabled={querying || !queryText.trim()}
                >
                  {querying ? (language === 'zh' ? '检索中...' : 'Searching...') : (language === 'zh' ? '🔍 检索' : '🔍 Search')}
                </button>
              </div>

              {queryResults.length > 0 && (
                <div style={{ marginTop: 'var(--space-6)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                    {language === 'zh' ? `检索结果 (${queryResults.length})` : `Results (${queryResults.length})`}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {queryResults.map((result, index) => (
                      <div
                        key={result.chunk_id}
                        style={{
                          padding: 'var(--space-4)',
                          background: 'var(--gray-50)',
                          borderRadius: 'var(--radius-md)',
                          borderLeft: '3px solid var(--primary)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                            {language === 'zh' ? `相关度` : `Relevance`}: {(result.score * 100).toFixed(1)}%
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                            {language === 'zh' ? `分块` : `Chunk`} #{result.position + 1}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                          {result.content}
                        </p>
                        <div style={{ marginTop: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          Document ID: {result.document_id.substring(0, 8)}...
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
