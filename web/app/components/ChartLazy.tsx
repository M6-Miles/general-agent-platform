'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// 懒加载图表组件（recharts 库较大，约 80KB）
export const LazyLineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  {
    loading: () => (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '300px',
        color: 'var(--text-secondary)',
        fontSize: '0.875rem'
      }}>
        <div className="spinner" style={{ marginRight: 'var(--space-2)' }}></div>
        加载图表...
      </div>
    ),
    ssr: false,
  }
);

export const LazyBarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  {
    loading: () => (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '300px',
        color: 'var(--text-secondary)',
        fontSize: '0.875rem'
      }}>
        <div className="spinner" style={{ marginRight: 'var(--space-2)' }}></div>
        加载图表...
      </div>
    ),
    ssr: false,
  }
);

export const LazyPieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  {
    loading: () => (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '300px',
        color: 'var(--text-secondary)',
        fontSize: '0.875rem'
      }}>
        <div className="spinner" style={{ marginRight: 'var(--space-2)' }}></div>
        加载图表...
      </div>
    ),
    ssr: false,
  }
);

// 导出 recharts 其他组件（无需懒加载，体积小）
export { Line, Bar, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
