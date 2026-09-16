// Shared navigation component
import React from 'react';
import Link from 'next/link';
import { Bell, LogOut, Settings, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { useConfirm } from './NotificationProvider';
import { Language } from '../../lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';

interface PlatformHeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  activePage?: string;
}

export default function PlatformHeader({ language, onLanguageChange, activePage }: PlatformHeaderProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const confirm = useConfirm();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);

  const handleLogout = async () => {
    if (await confirm(language === 'zh' ? '确定要退出登录吗？' : 'Logout?', language === 'zh' ? '退出登录' : 'Log out')) {
      await logout();
      router.push('/login');
    }
  };

  return (
    <header className="platform-header">
      <div className="header-container">
        <Link className="platform-logo" href="/" aria-label="Agent 平台概览">
          <div className="logo-icon">A</div>
          <span>{language === 'zh' ? 'Agent 平台' : language === 'en' ? 'Agent Platform' : 'エージェントプラットフォーム'}</span>
        </Link>

        <nav className="platform-nav">
          <Link className={`nav-link ${activePage === 'home' ? 'active' : ''}`} href="/" aria-current={activePage === 'home' ? 'page' : undefined}>
            {language === 'zh' ? '概览' : language === 'en' ? 'Overview' : '概要'}
          </Link>
          <Link className={`nav-link ${activePage === 'agents' ? 'active' : ''}`} href="/agents" aria-current={activePage === 'agents' ? 'page' : undefined}>
            {language === 'zh' ? 'Agent' : language === 'en' ? 'Agents' : 'エージェント'}
          </Link>
          <Link className={`nav-link ${activePage === 'conversations' ? 'active' : ''}`} href="/conversations" aria-current={activePage === 'conversations' ? 'page' : undefined}>
            {language === 'zh' ? '会话' : language === 'en' ? 'Chat' : '会話'}
          </Link>
          <Link className={`nav-link ${activePage === 'workflows' ? 'active' : ''}`} href="/workflows" aria-current={activePage === 'workflows' ? 'page' : undefined}>
            {language === 'zh' ? '工作流' : language === 'en' ? 'Workflows' : 'ワークフロー'}
          </Link>
          <Link className={`nav-link ${activePage === 'runs' ? 'active' : ''}`} href="/runs" aria-current={activePage === 'runs' ? 'page' : undefined}>
            {language === 'zh' ? '运行记录' : language === 'en' ? 'Runs' : '実行履歴'}
          </Link>
          <Link className={`nav-link ${activePage === 'tools' ? 'active' : ''}`} href="/tools" aria-current={activePage === 'tools' ? 'page' : undefined}>
            {language === 'zh' ? '工具' : language === 'en' ? 'Tools' : 'ツール'}
          </Link>
          <Link className={`nav-link ${activePage === 'skills' ? 'active' : ''}`} href="/skills" aria-current={activePage === 'skills' ? 'page' : undefined}>
            {language === 'zh' ? 'Skill' : language === 'en' ? 'Skills' : 'スキル'}
          </Link>
          <Link className={`nav-link ${activePage === 'knowledge' ? 'active' : ''}`} href="/knowledge" aria-current={activePage === 'knowledge' ? 'page' : undefined}>
            {language === 'zh' ? '知识库' : language === 'en' ? 'Knowledge' : '知識'}
          </Link>
          <Link className={`nav-link ${activePage === 'approvals' ? 'active' : ''}`} href="/approvals" aria-current={activePage === 'approvals' ? 'page' : undefined}>
            {language === 'zh' ? '审批' : language === 'en' ? 'Approvals' : '承認'}
          </Link>
          <Link className={`nav-link ${activePage === 'audit' ? 'active' : ''}`} href="/audit" aria-current={activePage === 'audit' ? 'page' : undefined}>
            {language === 'zh' ? '审计' : language === 'en' ? 'Audit' : '監査'}
          </Link>
        </nav>

        <div className="header-actions">
          <LanguageSwitcher currentLanguage={language} onLanguageChange={onLanguageChange} />

          {/* User Menu - 左侧 */}
          <div style={{ position: 'relative' }}>
            <button
              className="header-btn"
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="User menu"
              aria-expanded={showUserMenu}
              title={language === 'zh' ? '用户菜单' : 'User menu'}
            >
              <UserRound aria-hidden="true" size={20} strokeWidth={1.8} />
            </button>
            {showUserMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 'var(--space-2)',
                width: '200px',
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--border)',
                zIndex: 1000
              }}>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    router.push('/settings');
                  }}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3) var(--space-4)',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    borderBottom: '1px solid var(--border)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <Settings aria-hidden="true" size={16} />
                  {language === 'zh' ? '个人设置' : 'Settings'}
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    handleLogout();
                  }}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3) var(--space-4)',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    color: 'var(--error)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <LogOut aria-hidden="true" size={16} />
                  {language === 'zh' ? '退出登录' : 'Logout'}
                </button>
              </div>
            )}
          </div>

          {/* Notification Button - 右侧 */}
          <div style={{ position: 'relative' }}>
            <button
              className="header-btn"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notifications"
              aria-expanded={showNotifications}
              title={language === 'zh' ? '通知' : 'Notifications'}
            >
              <Bell aria-hidden="true" size={20} strokeWidth={1.8} />
            </button>
            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 'var(--space-2)',
                width: '320px',
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--border)',
                zIndex: 1000
              }}>
                <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border)' }}>
                  <h3 style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {language === 'zh' ? '通知' : 'Notifications'}
                  </h3>
                </div>
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <p style={{ fontSize: '0.875rem' }}>
                    {language === 'zh' ? '暂无通知' : 'No notifications'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
