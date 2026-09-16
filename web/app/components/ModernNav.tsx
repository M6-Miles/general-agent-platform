'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Language, getTranslation } from '../../lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';

interface ModernNavProps {
  activeTab?: string;
}

export default function ModernNav({ activeTab }: ModernNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [language, setLanguage] = React.useState<Language>('zh');

  React.useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang && ['en', 'zh', 'ja'].includes(savedLang)) {
      setLanguage(savedLang);
    }
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  const t = getTranslation(language);

  // Determine active tab from pathname if not provided
  const currentTab = activeTab || (() => {
    if (pathname === '/') return 'overview';
    if (pathname.startsWith('/agents')) return 'agents';
    if (pathname.startsWith('/workflows')) return 'workflows';
    if (pathname.startsWith('/tools')) return 'tools';
    if (pathname.startsWith('/knowledge')) return 'knowledge';
    if (pathname.startsWith('/runs')) return 'runs';
    if (pathname.startsWith('/settings')) return 'settings';
    return 'overview';
  })();

  const navigationItems = [
    { id: 'overview', label: t.overview, path: '/' },
    { id: 'agents', label: t.agents, path: '/agents' },
    { id: 'workflows', label: t.workflows, path: '/workflows' },
    { id: 'tools', label: t.tools, path: '/tools' },
    { id: 'knowledge', label: t.knowledge, path: '/knowledge' },
    { id: 'runs', label: t.runs, path: '/runs' },
  ];

  return (
    <header className="demo-header">
      <div className="demo-header-content">
        <div className="demo-logo" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
          <div className="demo-logo-mark">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#logo-gradient)"/>
              <path d="M16 8L24 16L16 24L8 16L16 8Z" fill="white" opacity="0.9"/>
              <defs>
                <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32">
                  <stop offset="0%" stopColor="#3b82f6"/>
                  <stop offset="100%" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="demo-logo-text">{t.appName}</span>
        </div>

        <nav className="demo-nav">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              className={currentTab === item.id ? 'demo-nav-item active' : 'demo-nav-item'}
              onClick={() => router.push(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="demo-header-actions">
          <LanguageSwitcher
            currentLanguage={language}
            onLanguageChange={handleLanguageChange}
          />
          <button className="demo-btn-secondary" onClick={() => router.push('/approvals')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z"/>
            </svg>
          </button>
          <button className="demo-btn-primary" onClick={() => router.push('/agents/create')}>
            {t.createAgent}
          </button>
        </div>
      </div>
    </header>
  );
}
