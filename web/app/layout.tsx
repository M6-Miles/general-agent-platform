import React from 'react';
import type {Metadata} from 'next';
import './design-system.css';
import './styles/index.css';
import AuthProvider from './components/AuthProvider';
import FocusManager from './components/FocusManager';
import NotificationProvider from './components/NotificationProvider';

export const metadata: Metadata = {
  title: 'Agent Platform - Auditable Agent Runtime',
  description: '面向多租户、工具调用和工作流执行的可审计 Agent Runtime',
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="zh-CN"><body><AuthProvider><NotificationProvider><FocusManager />{children}</NotificationProvider></AuthProvider></body></html>;
}
