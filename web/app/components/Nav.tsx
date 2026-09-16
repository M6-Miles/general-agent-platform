'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Activity, Bot, CheckCircle2, Gauge, Home, LibraryBig, MessageSquare, Network, ScrollText, Settings, Sparkles, Wrench, Skull} from 'lucide-react';
import {can, Permission} from '../../lib/permissions';
import {useAuth} from './AuthProvider';

type NavLink = {href: string; label: string; icon: typeof Home; permission?: Permission};
type NavGroup = {label: string; links: NavLink[]};

const groups: NavGroup[] = [
  {label: '主菜单', links: [
    {href: '/dashboard', label: '首页', icon: Home},
    {href: '/', label: '运行控制台', icon: Gauge},
    {href: '/conversations', label: '会话记录', icon: MessageSquare, permission: 'run:read'},
  ]},
  {label: '构建与运行', links: [
    {href: '/agents', label: 'Agent', icon: Bot, permission: 'agent:read'},
    {href: '/workflows', label: '工作流', icon: Network, permission: 'agent:read'},
    {href: '/runs', label: '运行记录', icon: Activity, permission: 'run:read'},
    {href: '/skills', label: 'Skill 市场', icon: Sparkles, permission: 'agent:read'},
    {href: '/tools', label: 'Tool 管理', icon: Wrench, permission: 'tool:read'},
  ]},
  {label: '数据与治理', links: [
    {href: '/knowledge', label: '知识库', icon: LibraryBig, permission: 'memory:read'},
    {href: '/approvals', label: '审批中心', icon: CheckCircle2, permission: 'approval:read'},
    {href: '/audit', label: '审计日志', icon: ScrollText, permission: 'audit:read'},
    {href: '/dlq', label: '死信队列', icon: Skull, permission: 'admin:settings'},
  ]},
  {label: '系统', links: [{href: '/settings', label: '设置', icon: Settings}]},
];

export default function Nav() {
  const pathname = usePathname();
  const {user} = useAuth();
  return <nav className="nav" aria-label="主导航">{groups.map((group) => {
    const visibleLinks = group.links.filter((item) => !item.permission || can(user?.role, item.permission));
    if (!visibleLinks.length) return null;
    return <div className="nav-group" key={group.label}>
      <span className="nav-group-label">{group.label}</span>
      {visibleLinks.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}><Icon aria-hidden="true" size={18} strokeWidth={1.8} /><span>{item.label}</span></Link>;
      })}
    </div>;
  })}</nav>;
}
