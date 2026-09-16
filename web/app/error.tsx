'use client';

export default function GlobalError({reset}: {error: Error & {digest?: string}; reset: () => void}) {
  return <main className="error-page"><h1>页面暂时不可用</h1><p>请求未完成，运行数据不会因此丢失。</p><button onClick={reset}>重新加载</button></main>;
}
