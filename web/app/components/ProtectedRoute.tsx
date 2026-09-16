'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireRoles?: string[];
  fallbackPath?: string;
}

/**
 * ProtectedRoute 组件 - 统一处理登录恢复竞态问题
 *
 * 功能：
 * 1. 等待 AuthProvider 的 refresh 完成
 * 2. 验证用户认证状态
 * 3. 验证用户角色权限
 * 4. 显示加载状态
 * 5. 自动重定向未授权用户
 */
export default function ProtectedRoute({
  children,
  requireAuth = true,
  requireRoles = [],
  fallbackPath = '/login'
}: ProtectedRouteProps) {
  const { token, user, ready } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // 等待认证状态就绪
    if (!ready) {
      return;
    }

    // 认证状态已就绪，开始检查
    if (requireAuth && !token) {
      // 需要认证但未登录，重定向到登录页
      router.push(fallbackPath);
      return;
    }

    // 检查角色权限
    if (requireRoles.length > 0 && user) {
      const hasRequiredRole = requireRoles.includes(user.role);
      if (!hasRequiredRole) {
        // 没有所需角色，重定向到首页或错误页
        router.push('/');
        return;
      }
    }

    // 所有检查通过
    setIsChecking(false);
  }, [ready, token, user, requireAuth, requireRoles, router, fallbackPath]);

  // 显示加载状态
  if (!ready || isChecking) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--gray-50)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid var(--gray-200)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto var(--space-4)',
            }}
          />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            加载中...
          </p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  // 渲染受保护的内容
  return <>{children}</>;
}
