'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { Language } from '../../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../../lib/api';
import { errorMessage } from '../../../lib/errors';
import PlatformHeader from '../../components/PlatformHeader';
import { useNotifier } from '../../components/NotificationProvider';
import '../../design-system.css';

export default function CreateKnowledgeBasePage() {
  const router = useRouter();
  const { token } = useAuth();
  const notify = useNotifier();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [embeddingModel, setEmbeddingModel] = React.useState('text-embedding-ada-002');
  const [chunkSize, setChunkSize] = React.useState(512);
  const [chunkOverlap, setChunkOverlap] = React.useState(50);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  React.useEffect(() => {
    if (!token) router.push('/login');
  }, [token, router]);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim() || !slug.trim()) return;

    setCreating(true);
    try {
      const result = await apiRequest(apiBaseUrl, '/api/v1/knowledge-bases', token, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          config: {
            embedding_model: embeddingModel,
            chunk_size: chunkSize,
            chunk_overlap: chunkOverlap,
            retrieval_strategy: 'hybrid'
          }
        })
      });

      notify(language === 'zh' ? '知识库创建成功！' : 'Knowledge base created successfully!', 'success');
      router.push('/knowledge');
    } catch (error: unknown) {
      notify(language === 'zh'
        ? `创建失败: ${errorMessage(error)}`
        : `Failed to create: ${errorMessage(error)}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PlatformHeader
        language={language}
        onLanguageChange={handleLanguageChange}
        activePage="knowledge"
      />

      <main className="platform-container">
        <div className="page-header">
          <h1 className="page-title">
            {language === 'zh' ? (
              <><span className="gradient">创建</span> 知识库</>
            ) : (
              <><span className="gradient">Create</span> Knowledge Base</>
            )}
          </h1>
          <p className="page-subtitle">
            {language === 'zh'
              ? '配置向量检索和文档分块策略'
              : 'Configure vector retrieval and document chunking strategy'}
          </p>
        </div>

        <div style={{ maxWidth: '800px' }}>
          <form onSubmit={handleSubmit} className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div>
                <label className="form-label" htmlFor="knowledge-name">
                  {language === 'zh' ? '知识库名称' : 'Name'}
                  <span style={{ color: 'var(--red-600)' }}> *</span>
                </label>
                <input
                  type="text"
                  id="knowledge-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={language === 'zh' ? '产品文档知识库' : 'Product Documentation'}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label" htmlFor="knowledge-slug">
                  {language === 'zh' ? 'Slug (唯一标识)' : 'Slug'}
                  <span style={{ color: 'var(--red-600)' }}> *</span>
                </label>
                <input
                  type="text"
                  id="knowledge-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="product-docs"
                  className="form-input"
                  required
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                  {language === 'zh' ? '仅支持小写字母、数字和连字符' : 'Only lowercase letters, numbers and hyphens'}
                </p>
              </div>

              <div>
                <label className="form-label" htmlFor="knowledge-description">
                  {language === 'zh' ? '描述' : 'Description'}
                </label>
                <textarea
                  value={description}
                  id="knowledge-description"
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={language === 'zh' ? '包含产品使用手册、API 文档等...' : 'Contains product manuals, API docs...'}
                  className="form-input"
                  rows={3}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-6)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                  {language === 'zh' ? '高级配置' : 'Advanced Configuration'}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div>
                    <label className="form-label">
                      {language === 'zh' ? '嵌入模型' : 'Embedding Model'}
                    </label>
                    <select
                      value={embeddingModel}
                      onChange={(e) => setEmbeddingModel(e.target.value)}
                      className="form-input"
                    >
                      <option value="text-embedding-ada-002">text-embedding-ada-002</option>
                      <option value="text-embedding-3-small">text-embedding-3-small</option>
                      <option value="text-embedding-3-large">text-embedding-3-large</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">
                      {language === 'zh' ? '分块大小 (Chunk Size)' : 'Chunk Size'}
                    </label>
                    <input
                      type="number"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(Number(e.target.value))}
                      min={128}
                      max={2048}
                      className="form-input"
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                      {language === 'zh' ? '每个文档块的字符数 (128-2048)' : 'Characters per chunk (128-2048)'}
                    </p>
                  </div>

                  <div>
                    <label className="form-label">
                      {language === 'zh' ? '块重叠 (Chunk Overlap)' : 'Chunk Overlap'}
                    </label>
                    <input
                      type="number"
                      value={chunkOverlap}
                      onChange={(e) => setChunkOverlap(Number(e.target.value))}
                      min={0}
                      max={512}
                      className="form-input"
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                      {language === 'zh' ? '相邻块之间的重叠字符数 (0-512)' : 'Overlapping characters between chunks (0-512)'}
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-4)' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !name.trim() || !slug.trim()}
                >
                  {creating
                    ? (language === 'zh' ? '创建中...' : 'Creating...')
                    : (language === 'zh' ? '创建知识库' : 'Create Knowledge Base')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => router.push('/knowledge')}
                  disabled={creating}
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
