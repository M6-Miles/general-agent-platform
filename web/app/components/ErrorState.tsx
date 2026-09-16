'use client';

import React from 'react';

export type DataState = 'loading' | 'error' | 'empty' | 'success';

interface ErrorStateProps {
  state: DataState;
  error?: string | null;
  emptyMessage?: string;
  loadingMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  onRetry?: () => void;
  children?: React.ReactNode;
  className?: string;
}

/**
 * ErrorState 组件 - 统一的数据状态展示
 *
 * 用于区分和展示：
 * 1. loading - 加载中
 * 2. error - 错误状态（带重试按钮）
 * 3. empty - 空数据状态
 * 4. success - 成功状态，显示 children
 */
export default function ErrorState({
  state,
  error = null,
  emptyMessage = '暂无数据',
  loadingMessage = '加载中...',
  emptyTitle,
  emptyDescription,
  emptyAction,
  emptyIcon,
  onRetry,
  children,
  className
}: ErrorStateProps) {
  // 加载中状态
  if (state === 'loading') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--data-state-padding, var(--space-8))',
          color: 'var(--text-secondary)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--gray-200)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: 'var(--space-4)',
          }}
        />
        <p>{loadingMessage}</p>
      </div>
    );
  }

  // 错误状态
  if (state === 'error') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--data-state-padding, var(--space-8))',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--error-50)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            marginBottom: 'var(--space-4)',
          }}
        >
          ⚠️
        </div>
        <h3
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-2)',
          }}
        >
          加载失败
        </h3>
        {error && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              marginBottom: 'var(--space-4)',
              maxWidth: '400px',
            }}
          >
            {error}
          </p>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn btn-primary"
            style={{
              marginTop: 'var(--space-2)',
            }}
          >
            🔄 重试
          </button>
        )}
      </div>
    );
  }

  // 空数据状态
  if (state === 'empty') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--data-state-padding, var(--space-8))',
          textAlign: 'center',
        }}
      >
        <div className="empty-state-visual" aria-hidden="true">{emptyIcon ?? '📭'}</div>
        {emptyTitle && <h3 style={{fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--space-2)'}}>{emptyTitle}</h3>}
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
          }}
        >
          {emptyDescription || emptyMessage}
        </p>
        {emptyAction}
      </div>
    );
  }

  // 成功状态，显示内容
  return <>{children}</>;
}

/**
 * useDataState Hook - 便捷的状态管理
 *
 * 用法示例：
 * const { state, setLoading, setError, setEmpty, setSuccess } = useDataState();
 *
 * try {
 *   setLoading();
 *   const data = await fetchData();
 *   if (data.length === 0) setEmpty();
 *   else setSuccess();
 * } catch (err) {
 *   setError(err.message);
 * }
 */
export function useDataState(initialState: DataState = 'loading') {
  const [state, setState] = React.useState<DataState>(initialState);
  const [error, setErrorMessage] = React.useState<string | null>(null);

  return {
    state,
    error,
    setLoading: () => {
      setState('loading');
      setErrorMessage(null);
    },
    setError: (message: string) => {
      setState('error');
      setErrorMessage(message);
    },
    setEmpty: () => {
      setState('empty');
      setErrorMessage(null);
    },
    setSuccess: () => {
      setState('success');
      setErrorMessage(null);
    },
  };
}
