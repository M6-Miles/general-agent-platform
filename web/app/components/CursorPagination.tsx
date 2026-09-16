'use client';

type Props = {page: number; hasPrevious: boolean; hasNext: boolean; onPrevious: () => void; onNext: () => void; busy?: boolean};

export default function CursorPagination({page, hasPrevious, hasNext, onPrevious, onNext, busy = false}: Props) {
  if (!hasPrevious && !hasNext) return null;
  return <nav className="pagination" aria-label="列表分页"><button className="secondary-button" disabled={busy || !hasPrevious} onClick={onPrevious}>上一页</button><span aria-live="polite">第 {page} 页</span><button className="secondary-button" disabled={busy || !hasNext} onClick={onNext}>下一页</button></nav>;
}
