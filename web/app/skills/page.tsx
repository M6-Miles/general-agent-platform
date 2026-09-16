'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { Language } from '../../lib/i18n';
import { apiBaseUrl, apiRequest } from '../../lib/api';
import PlatformHeader from '../components/PlatformHeader';
import ErrorState from '../components/ErrorState';
import '../design-system.css';

type Skill = {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export default function SkillsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [language, setLanguage] = React.useState<Language>('zh');
  const [skills, setSkills] = React.useState<Skill[]>([]);
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
    loadSkills();
  }, [token, router]);

  const loadSkills = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<Skill[]>(apiBaseUrl, '/api/v1/skills', token);
      // Delay to simulate loading for better UX perception
      await new Promise(resolve => setTimeout(resolve, 300));
      setSkills(result.data || []);
    } catch (error) {
      console.error('Failed to load skills:', error);
      setError(error instanceof Error ? error.message : '加载 Skill 失败');
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
        activePage="skills"
      />

      {/* Main Content */}
      <main className="platform-container">
        <div className="page-header">
          <div className="page-header-title-row">
            <h1 className="page-title">
              {language === 'zh' ? (
                <><span className="gradient">Skill</span> 市场</>
              ) : (
                <><span className="gradient">Skill</span> Marketplace</>
              )}
            </h1>
            <button className="header-btn-primary" onClick={() => router.push('/skills/create')}>
              {language === 'zh' ? '+ 提交 Skill' : '+ Submit Skill'}
            </button>
          </div>
          <p className="page-subtitle">
            {language === 'zh'
              ? '发现和安装可复用的 Skill 包。每个 Skill 经过审核，支持版本管理和依赖解析。'
              : 'Discover and install reusable skill packages. Each skill is reviewed with version management and dependency resolution.'}
          </p>
        </div>

        {loading ? (
          <ErrorState state="loading" loadingMessage={language === 'zh' ? '加载中...' : 'Loading...'} />
        ) : error ? (
          <ErrorState state="error" error={error} onRetry={() => void loadSkills()} />
        ) : skills.length === 0 ? (
          <ErrorState
            className="directory-empty-state"
            state="empty"
            emptyIcon="🎯"
            emptyTitle={language === 'zh' ? '还没有 Skill' : 'No Skills Yet'}
            emptyDescription={language === 'zh' ? '提交您的第一个 Skill 到市场' : 'Submit your first skill to the marketplace'}
            emptyAction={<button className="btn btn-primary btn-large" onClick={() => router.push('/skills/create')}>
              {language === 'zh' ? '提交第一个 Skill' : 'Submit First Skill'}
            </button>}
          />
        ) : (
          <div className="cards-grid">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="entity-card"
                onClick={() => router.push(`/skills/${skill.id}`)}
              >
                <div className="entity-icon">🎯</div>
                <h3 className="entity-name">{skill.name}</h3>
                <p className="entity-description">
                  {skill.description || (language === 'zh' ? '暂无描述' : 'No description')}
                </p>
                <div className="entity-footer">
                  <span className={`entity-status ${skill.status}`}>
                    {skill.status}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    v{skill.version}
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
