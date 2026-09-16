'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { Language } from '../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../lib/api';
import PlatformHeader from '../components/PlatformHeader';
import ErrorState from '../components/ErrorState';
import { LibraryBig } from 'lucide-react';
import '../design-system.css';

type KnowledgeBase = {
  id: string;
  slug: string;
  name: string;
  description: string;
  created_at: string;
};

export default function KnowledgeBasePage() {
  const router = useRouter();
  const { token } = useAuth();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [knowledgeBases, setKnowledgeBases] = React.useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  React.useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadKnowledgeBases();
  }, [token, router]);

  const loadKnowledgeBases = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<KnowledgeBase[]>(apiBaseUrl, '/api/v1/knowledge-bases', token);
      setKnowledgeBases(result.data || []);
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
      setError(error instanceof Error ? error.message : '加载知识库失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  return (
    <div>
      <PlatformHeader
        language={language}
        onLanguageChange={handleLanguageChange}
        activePage="knowledge"
      />

      {/* Main Content */}
      <main className="platform-container">
        <div className="page-header">
          <div className="page-header-title-row">
            <h1 className="page-title">
              {language === 'zh' ? (
                <><span className="gradient">知识库</span> 管理</>
              ) : (
                <><span className="gradient">Knowledge</span> Base</>
              )}
            </h1>
            <button className="header-btn-primary" onClick={() => router.push('/knowledge/create')}>
              {language === 'zh' ? '+ 创建知识库' : '+ Create KB'}
            </button>
          </div>
          <p className="page-subtitle">
            {language === 'zh'
              ? '构建向量知识库。支持文档导入、混合检索（向量 + BM25）和重排序。'
              : 'Build vector knowledge bases. Supports document import, hybrid retrieval (vector + BM25) and reranking.'}
          </p>
        </div>

        {loading ? (
          <ErrorState state="loading" loadingMessage={language === 'zh' ? '加载中...' : 'Loading...'} />
        ) : error ? (
          <ErrorState state="error" error={error} onRetry={() => void loadKnowledgeBases()} />
        ) : knowledgeBases.length === 0 ? (
          <ErrorState className="empty-state directory-empty-state" state="empty" emptyIcon={<LibraryBig size={30} />} emptyTitle={language === 'zh' ? '还没有知识库' : 'No Knowledge Bases Yet'} emptyDescription={language === 'zh' ? '创建第一个知识库来存储和检索文档' : 'Create your first knowledge base to store and retrieve documents'} emptyAction={<button className="btn btn-primary btn-large" onClick={() => router.push('/knowledge/create')}>
              {language === 'zh' ? '创建第一个知识库' : 'Create First Knowledge Base'}
            </button>} />
        ) : (
          <div className="cards-grid">
            {knowledgeBases.map((kb) => (
              <div
                key={kb.id}
                className="entity-card"
                onClick={() => router.push(`/knowledge/${kb.id}`)}
              >
                <div className="entity-icon">📚</div>
                <h3 className="entity-name">{kb.name}</h3>
                <p className="entity-description">
                  {kb.description || (language === 'zh' ? '暂无描述' : 'No description')}
                </p>
                <div className="entity-footer">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {kb.slug}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                    {new Date(kb.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
