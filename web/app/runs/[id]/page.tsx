'use client';

import Link from 'next/link';
import {ArrowLeft, CircleStop, Play, RefreshCw, RotateCcw} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useParams} from 'next/navigation';
import Workspace from '../../components/Workspace';
import {useAuth} from '../../components/AuthProvider';
import {useConfirm, useNotifier} from '../../components/NotificationProvider';
import {apiBaseUrl, apiRequest} from '../../../lib/api';
import {parseApiDate} from '../../../lib/date';
import {can} from '../../../lib/permissions';
import {displayLabel} from '../../../lib/labels';

type Run = {id: string; tenant_id: string; agent_id: string; status: string; attempt_id: string; checkpoint_version: number; created_at: string; updated_at: string; finished_at: string | null; output_json: Record<string, unknown> | null; usage_json: Record<string, unknown>; cost_usd: number; snapshot_id: string | null};
type EventItem = {event: string; eventId?: string; sequence?: number; data: unknown};
const terminal = new Set(['completed', 'failed', 'cancelled', 'timed_out', 'budget_exceeded']);
const replayable = new Set(['failed', 'cancelled', 'timed_out', 'budget_exceeded']);
const restorable = new Set(['failed', 'cancelled', 'waiting_approval']);
const errors: Record<string, string> = {RESUME_WINDOW_EXPIRED: '事件恢复窗口已过期，请刷新后重新连接。', RUN_NOT_RESTORABLE: '当前状态不支持从 Checkpoint 恢复。', RUN_NOT_REPLAYABLE: '当前状态不支持重放。', CONFLICT: '运行状态已发生变化，请刷新后重试。', NOT_FOUND: '运行不存在或无权访问。'};

export default function RunDetailPage() {
  const {token, user} = useAuth();
  const notify = useNotifier();
  const confirm = useConfirm();
  const params = useParams<{id: string}>();
  const id = params?.id;
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [checkpoint, setCheckpoint] = useState('');
  const lastEvent = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const canRead = can(user?.role, 'run:read');
  const canExecute = can(user?.role, 'run:execute');

  const load = useCallback(async () => {
    if (!token || !id || !canRead) { setLoading(false); return; }
    setLoading(true); setError('');
    try { const result = await apiRequest<Run>(apiBaseUrl, `/api/v1/runs/${encodeURIComponent(id)}`, token); setRun(result.data); setCheckpoint(String(result.data.checkpoint_version || 1)); }
    catch (cause) { const code = cause instanceof Error ? cause.message : String(cause); setError(errors[code] ?? code); }
    finally { setLoading(false); }
  }, [canRead, id, token]);

  const connect = useCallback(async (after = lastEvent.current) => {
    if (!token || !id) return;
    abortRef.current?.abort(); const controller = new AbortController(); abortRef.current = controller; setStreaming(true);
    try {
      const headers: HeadersInit = {Authorization: `Bearer ${token}`}; if (after > 0) headers['Last-Event-ID'] = String(after);
      const response = await fetch(`${apiBaseUrl}/api/v1/runs/${encodeURIComponent(id)}/events`, {headers, signal: controller.signal});
      if (!response.ok || !response.body) { const body = await response.json().catch(() => ({})); throw new Error(body?.error?.code ?? `HTTP_${response.status}`); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) { const {value, done} = await reader.read(); if (done) break; buffer += decoder.decode(value, {stream: true}); const chunks = buffer.split('\n\n'); buffer = chunks.pop() ?? ''; for (const chunk of chunks) { const event = chunk.match(/^event:\s*(.+)$/m)?.[1] ?? 'message'; const eventId = chunk.match(/^id:\s*(.+)$/m)?.[1]; const line = chunk.match(/^data:\s*(.+)$/m)?.[1]; if (!line) continue; const parsed = JSON.parse(line) as {sequence?: number; data?: unknown; event_id?: string}; const sequence = parsed.sequence; if (sequence !== undefined) lastEvent.current = sequence; setEvents((current) => [...current, {event, eventId: eventId ?? parsed.event_id, sequence, data: parsed.data}]); } }
    } catch (cause) { if (!controller.signal.aborted) { const code = cause instanceof Error ? cause.message : String(cause); notify(errors[code] ?? `事件流连接失败：${code}`, 'error'); if (code === 'RESUME_WINDOW_EXPIRED') { lastEvent.current = 0; await load(); } } }
    finally { if (!controller.signal.aborted) setStreaming(false); }
  }, [id, load, notify, token]);

  const executeStream = useCallback(async () => {
    if (!token || !id) return;
    abortRef.current?.abort(); const controller = new AbortController(); abortRef.current = controller; setStreaming(true); setEvents([]); lastEvent.current = 0;
    try {
      await apiRequest(apiBaseUrl, `/api/v1/runs/${encodeURIComponent(id)}/execute?async=true`, token, {method: 'POST', signal: controller.signal});
      await connect(0);
      await load();
      return;
    } catch (cause) {
      if (!controller.signal.aborted) notify(`异步执行失败：${cause instanceof Error ? cause.message : String(cause)}`, 'error');
      return;
    } finally {
      if (!controller.signal.aborted) setStreaming(false);
    }
  }, [id, load, notify, token]);

  useEffect(() => { void load(); return () => abortRef.current?.abort(); }, [load]);
  useEffect(() => { if (run && events.length === 0) void connect(0); }, [run, connect, events.length]);

  async function action(kind: 'cancel' | 'replay' | 'restore') {
    if (!run || !token || !(await confirm(kind === 'cancel' ? '确认取消此运行？' : kind === 'replay' ? '确认重放此运行？' : '确认从指定 Checkpoint 恢复？', '运行操作确认'))) return;
    try {
      const path = kind === 'cancel' ? 'cancel' : kind === 'replay' ? 'replay' : 'restore';
      const body = kind === 'restore' ? JSON.stringify({checkpoint_version: Number(checkpoint)}) : undefined;
      const result = await apiRequest<Run>(apiBaseUrl, `/api/v1/runs/${run.id}/${path}`, token, {method: 'POST', ...(body ? {body} : {})});
      setRun(result.data); notify(kind === 'cancel' ? '运行已取消' : kind === 'replay' ? '已创建重放运行' : '已从 Checkpoint 恢复', 'success');
      if (terminal.has(result.data.status)) { lastEvent.current = 0; setEvents([]); await connect(0); }
      else {
        const eventName = kind === 'replay' ? 'run.replayed' : 'run.restored';
        const sequence = lastEvent.current + 1;
        lastEvent.current = sequence;
        setEvents((current) => [...current, {event: eventName, sequence, data: {status: result.data.status, operation: kind}}]);
      }
    } catch (cause) { const code = cause instanceof Error ? cause.message : String(cause); notify(errors[code] ?? `操作失败：${code}`, 'error'); await load(); }
  }

  if (user && !canRead) return <Workspace title="运行详情"><section className="panel permission-state"><h2>无权查看运行详情</h2><p className="hint">当前角色没有运行读取权限。</p></section></Workspace>;
  return <Workspace title="运行详情"><div className="run-detail-page"><Link className="text-link run-back" href="/runs"><ArrowLeft size={15} aria-hidden="true" />返回运行记录</Link>{loading ? <div className="skeleton-list" role="status" aria-label="正在加载运行详情"><i/><i/></div> : error ? <section className="panel error-state"><p>{error}</p><button onClick={() => void load()}>重试</button></section> : run && <><section className="panel run-summary"><div className="run-summary-heading"><div><span className="eyebrow">RUN</span><h2>{run.id}</h2></div><span className={`badge ${run.status}`}>{displayLabel(run.status)}</span></div><dl className="detail-list run-meta"><div><dt>Agent</dt><dd><code>{run.agent_id}</code></dd></div><div><dt>Attempt</dt><dd><code>{run.attempt_id}</code></dd></div><div><dt>Checkpoint</dt><dd>v{run.checkpoint_version}</dd></div><div><dt>创建时间</dt><dd>{parseApiDate(run.created_at).toLocaleString('zh-CN')}</dd></div><div><dt>结束时间</dt><dd>{run.finished_at ? parseApiDate(run.finished_at).toLocaleString('zh-CN') : '未结束'}</dd></div><div><dt>成本</dt><dd>${run.cost_usd.toFixed(4)}</dd></div></dl><div className="run-actions">{canExecute && !terminal.has(run.status) && <button className="danger-button icon-text-button" onClick={() => void action('cancel')}><CircleStop size={16} aria-hidden="true" />取消运行</button>}{canExecute && !terminal.has(run.status) && <button className="primary-button icon-text-button" onClick={() => void executeStream()} disabled={streaming}><Play size={16} aria-hidden="true" />流式执行</button>}{canExecute && replayable.has(run.status) && <button className="secondary-button icon-text-button" onClick={() => void action('replay')}><Play size={16} aria-hidden="true" />重放</button>}{canExecute && restorable.has(run.status) && <label className="checkpoint-action"><span>Checkpoint 版本</span><input type="number" min="1" value={checkpoint} onChange={(e) => setCheckpoint(e.target.value)} /><button className="secondary-button icon-text-button" onClick={() => void action('restore')} disabled={!/^[1-9]\d*$/.test(checkpoint)}><RotateCcw size={16} aria-hidden="true" />恢复</button></label>}<button className="secondary-button icon-text-button" onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" />刷新</button></div></section><section className="panel run-events"><div className="section-heading"><div><h2>事件时间线 <span>{events.length}</span></h2><p className="hint">按事件序号展示 SSE 执行进度，支持断点续接。</p></div><button className="secondary-button" onClick={() => void connect()} disabled={streaming}>{streaming ? '连接中...' : '从断点续接'}</button></div>{events.length === 0 ? <div className="empty-state">暂无事件，运行产生事件后会显示在这里。</div> : <div className="event-timeline">{events.map((item, index) => <article className="event-item" key={`${item.eventId ?? item.sequence ?? index}-${index}`}><div><span className="event-type">{displayLabel(item.event)}</span><span className="event-seq">#{item.sequence ?? '-'}</span></div><pre>{JSON.stringify(item.data, null, 2)}</pre></article>)}</div>}</section>{(run.output_json || Object.keys(run.usage_json ?? {}).length > 0) && <section className="panel run-output"><h2>运行结果</h2><pre>{JSON.stringify({output: run.output_json, usage: run.usage_json}, null, 2)}</pre></section>}</>}</div></Workspace>;
}
