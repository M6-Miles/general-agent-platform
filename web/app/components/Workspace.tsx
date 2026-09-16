'use client';

import {usePathname, useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import PlatformHeader from './PlatformHeader';
import {useAuth} from './AuthProvider';
import {Language} from '../../lib/i18n';

export default function Workspace({title, children, immersive = false}: {title: string; children: React.ReactNode; immersive?: boolean}) {
  const {ready, token} = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [language, setLanguage] = useState<Language>('zh');

  useEffect(() => {
    if (ready && !token) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, token, pathname, router]);

  useEffect(() => {
    const saved = localStorage.getItem('preferred-language') as Language | null;
    if (saved && ['zh', 'en', 'ja'].includes(saved)) setLanguage(saved);
  }, []);

  const activePage = pathname.startsWith('/agents') ? 'agents'
    : pathname.startsWith('/conversations') ? 'conversations'
    : pathname.startsWith('/workflows') || pathname.startsWith('/workflow-instances') ? 'workflows'
    : pathname.startsWith('/runs') ? 'runs'
    : pathname.startsWith('/tools') ? 'tools'
    : pathname.startsWith('/skills') ? 'skills'
    : pathname.startsWith('/knowledge') ? 'knowledge'
    : pathname.startsWith('/approvals') ? 'approvals'
    : pathname.startsWith('/audit') ? 'audit'
    : undefined;

  if (!ready || !token) return <main className="loading-screen">正在验证会话...</main>;
  return <>
    <PlatformHeader
      language={language}
      onLanguageChange={(next) => {
        setLanguage(next);
        localStorage.setItem('preferred-language', next);
      }}
      activePage={activePage}
    />
    <main className={`platform-container workspace-content${immersive ? ' workspace-content--immersive' : ''}`} id="main-content" tabIndex={-1}>
      {!immersive && <div className="page-header workspace-page-header">
        <p className="eyebrow">AGENT RUNTIME</p>
        <h1 className="page-title">{title}</h1>
      </div>}
      {children}
    </main>
  </>;
}
