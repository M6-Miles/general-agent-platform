'use client';

import React, { useState } from 'react';

interface CodeBlockProps {
  language: string;
  code: string;
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
      <div
        style={{
          position: 'absolute',
          top: 'var(--space-3)',
          right: 'var(--space-3)',
          zIndex: 10,
        }}
      >
        <button
          onClick={handleCopy}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            background: copied ? 'var(--success)' : 'var(--gray-700)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ 已复制' : '复制'}
        </button>
      </div>

      <div
        style={{
          background: 'var(--gray-50)',
          border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'var(--gray-100)',
            padding: 'var(--space-2) var(--space-4)',
            borderBottom: '1px solid var(--gray-200)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {language}
        </div>
        <pre
          style={{
            background: 'var(--gray-900)',
            color: '#d4d4d4',
            padding: 'var(--space-4)',
            margin: 0,
            overflow: 'auto',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          }}
        >
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
