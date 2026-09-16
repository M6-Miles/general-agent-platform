'use client';

import {KeyboardEvent, useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {
  Bot,
  ExternalLink,
  Menu,
  MessageSquarePlus,
  PanelLeftClose,
  RefreshCw,
  SendHorizontal,
  UserRound,
} from 'lucide-react';
import Workspace from '../components/Workspace';
import {useAuth} from '../components/AuthProvider';
import {useNotifier} from '../components/NotificationProvider';
import {apiBaseUrl, apiRequest, isAbortError} from '../../lib/api';
import {displayLabel} from '../../lib/labels';

type Agent = {id: string; name: string; status?: string};
type Run = {
  id: string;
  agent_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  input_json?: Record<string, unknown>;
  output_json?: Record<string, unknown> | null;
};
type StreamEvent = {event: string; sequence?: number; data?: unknown};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readResultValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const data = record(value);
  if (!data) return null;
  for (const key of ['text', 'answer', 'content', 'result', 'value']) {
    const candidate = data[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (typeof candidate === 'number' || typeof candidate === 'boolean') return String(candidate);
  }
  return null;
}

function assistantReply(run: Run): string | null {
  const output = record(run.output_json);
  if (!output) return null;
  if (output.error) return `执行失败：${String(output.error)}`;

  const workflow = Array.isArray(output.workflow) ? output.workflow : [];
  for (let index = workflow.length - 1; index >= 0; index -= 1) {
    const node = record(workflow[index]);
    const reply = readResultValue(node?.output);
    if (reply && reply !== 'succeeded') return reply;
  }

  const context = record(output.context);
  if (context) {
    const values = Object.entries(context).filter(([key]) => key !== 'prompt').reverse();
    for (const [, value] of values) {
      const reply = readResultValue(value);
      if (reply && reply !== 'succeeded') return reply;
    }
  }
  return readResultValue(output);
}

const sourceLabels: Record<string, string> = {
  restore: '恢复运行',
  replay: '重放运行',
  'cancel-refresh': '取消/刷新测试',
  'detail-ui': '运行详情测试',
  'run-detail-test': '运行详情测试',
  'run-list-test': '运行列表测试',
  'ui-approval-test': '审批流程测试',
};

function promptText(run: Run): string | null {
  const prompt = run.input_json?.prompt;
  return typeof prompt === 'string' && prompt.trim() ? prompt.trim() : null;
}

function conversationTitle(run: Run, agentName?: string): string {
  const prompt = promptText(run);
  if (prompt) return prompt;

  const input = run.input_json || {};
  const source = typeof input.source === 'string' ? input.source : '';
  if (source) return sourceLabels[source] || `系统运行 · ${source}`;

  const route = typeof input.route === 'string' ? input.route : '';
  if (route) return `条件分支：${route}`;

  for (const key of ['query', 'knowledge_query', 'message', 'text']) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return `${agentName || 'Agent'} · ${displayLabel(run.status)}`;
}

function unrecordedMessage(run: Run): string {
  const input = run.input_json || {};
  const source = typeof input.source === 'string' ? input.source : '';
  const route = typeof input.route === 'string' ? input.route : '';
  if (source) return `该运行由“${sourceLabels[source] || source}”触发，未包含文本消息。`;
  if (route) return `该运行使用条件分支“${route}”，未包含文本消息。`;
  return '该运行未记录文本消息，结构化输入可在运行详情中查看。';
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('zh-CN', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
}

export default function ConversationsPage() {
  const {token} = useAuth();
  const notify = useNotifier();
  const abortRef = useRef<AbortController | null>(null);
  const lastEvent = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [agentId, setAgentId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [agentResult, runResult] = await Promise.all([
        apiRequest<Agent[]>(apiBaseUrl, '/api/v1/agents?limit=100', token),
        apiRequest<Run[]>(apiBaseUrl, '/api/v1/conversations?limit=50', token),
      ]);
      setAgents(agentResult.data);
      setRuns(runResult.data);
      setAgentId((current) => current || agentResult.data[0]?.id || '');
    } catch (cause) {
      setError(String(cause));
    } finally {
      setLoading(false);
    }
  };

  const loadRuns = async () => {
    if (!token) return;
    const result = await apiRequest<Run[]>(apiBaseUrl, '/api/v1/conversations?limit=50', token);
    setRuns(result.data);
  };

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [token]);

  const startNew = () => {
    abortRef.current?.abort();
    setSelected(null);
    setEvents([]);
    setMessage('');
    setHistoryOpen(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const open = async (run: Run) => {
    abortRef.current?.abort();
    setSelected(run);
    setEvents([]);
    setAgentId(run.agent_id);
    setHistoryOpen(false);
    if (!token) return;
    try {
      const result = await apiRequest<Run>(apiBaseUrl, `/api/v1/conversations/${encodeURIComponent(run.id)}`, token);
      setSelected(result.data);
    } catch (cause) {
      notify(`会话加载失败：${String(cause)}`, 'error');
    }
  };

  const streamRun = async (runId: string) => {
    if (!token) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let attempt = 0;
    while (!controller.signal.aborted && attempt < 4) {
      try {
        const headers: HeadersInit = {Authorization: `Bearer ${token}`};
        if (lastEvent.current > 0) headers['Last-Event-ID'] = String(lastEvent.current);
        const response = await fetch(`${apiBaseUrl}/api/v1/runs/${encodeURIComponent(runId)}/events`, {headers, signal: controller.signal});
        if (!response.ok || !response.body) throw new Error(`HTTP_${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const {value, done} = await reader.read();
          if (done) return;
          buffer += decoder.decode(value, {stream: true});
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';
          for (const chunk of chunks) {
            const event = chunk.match(/^event:\s*(.+)$/m)?.[1];
            const line = chunk.match(/^data:\s*(.+)$/m)?.[1];
            if (!event || !line) continue;
            try {
              const payload = JSON.parse(line) as {sequence?: number; data?: unknown};
              if (payload.sequence !== undefined) lastEvent.current = payload.sequence;
              setEvents((items) => [...items, {event, sequence: payload.sequence, data: payload.data}]);
            } catch {
              // Ignore malformed SSE payloads and keep the connection alive.
            }
          }
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        attempt += 1;
        if (attempt >= 4) throw cause;
        await new Promise((resolve) => window.setTimeout(resolve, 250 * 2 ** (attempt - 1)));
      }
    }
  };

  const send = async () => {
    if (!token || !agentId || !message.trim()) return;
    setSending(true);
    setEvents([]);
    lastEvent.current = 0;
    try {
      const result = await apiRequest<Run>(apiBaseUrl, '/api/v1/runs', token, {
        method: 'POST',
        headers: {'Idempotency-Key': `conversation-${crypto.randomUUID()}`},
        body: JSON.stringify({agent_id: agentId, input: {prompt: message.trim()}}),
      });
      setMessage('');
      setSelected(result.data);
      notify('消息已提交执行', 'success');
      await streamRun(result.data.id);
      await loadRuns();
      const latest = await apiRequest<Run>(apiBaseUrl, `/api/v1/conversations/${encodeURIComponent(result.data.id)}`, token);
      setSelected(latest.data);
    } catch (cause) {
      if (!isAbortError(cause)) notify(`发送或执行失败：${String(cause)}`, 'error');
    } finally {
      setSending(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  const selectedAgent = agents.find((agent) => agent.id === agentId);
  const reply = selected ? assistantReply(selected) : null;

  return <Workspace title="Agent 会话" immersive>
    <section className="conversation-shell" aria-label="Agent 会话工作区">
      <aside className={`conversation-sidebar${historyOpen ? ' is-open' : ''}`} aria-label="会话记录">
        <div className="conversation-sidebar-header">
          <div>
            <h1>会话记录</h1>
            <span>{runs.length} 条记录</span>
          </div>
          <button className="conversation-icon-button conversation-close-history" type="button" onClick={() => setHistoryOpen(false)} aria-label="关闭会话记录" title="关闭会话记录">
            <PanelLeftClose size={19} aria-hidden="true" />
          </button>
        </div>

        <button className="conversation-new-button" type="button" onClick={startNew}>
          <MessageSquarePlus size={18} aria-hidden="true" />
          新会话
        </button>

        <div className="conversation-history-toolbar">
          <span>最近会话</span>
          <button className="conversation-icon-button" type="button" onClick={() => void load()} disabled={loading} aria-label="刷新会话记录" title="刷新会话记录">
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>

        {loading ? <div className="conversation-history-skeleton" role="status" aria-label="正在加载会话记录"><i /><i /><i /></div>
          : error ? <div className="conversation-history-state" role="alert"><p>会话加载失败</p><button type="button" onClick={() => void load()}>重试</button></div>
            : runs.length === 0 ? <div className="conversation-history-state"><MessageSquarePlus size={22} aria-hidden="true" /><p>还没有会话</p></div>
              : <div className="conversations-list">{runs.map((run) => <button className={`conversation-card${selected?.id === run.id ? ' is-selected' : ''}`} type="button" key={run.id} onClick={() => void open(run)}>
                <span className="conversation-card-copy">
                  <strong>{conversationTitle(run, agents.find((agent) => agent.id === run.agent_id)?.name)}</strong>
                  <small>{agents.find((agent) => agent.id === run.agent_id)?.name || '未知 Agent'} · {formatTime(run.created_at)}</small>
                </span>
                <span className={`conversation-status-dot ${run.status}`} title={displayLabel(run.status)} aria-label={displayLabel(run.status)} />
              </button>)}</div>}
      </aside>

      {historyOpen && <button className="conversation-backdrop" type="button" onClick={() => setHistoryOpen(false)} aria-label="关闭会话记录" />}

      <div className="conversation-main">
        <header className="conversation-topbar">
          <button className="conversation-icon-button conversation-history-toggle" type="button" onClick={() => setHistoryOpen(true)} aria-label="打开会话记录" title="打开会话记录">
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="conversation-agent-mark"><Bot size={21} aria-hidden="true" /></div>
          <label className="conversation-agent-select">
            <span>当前 Agent</span>
            <select value={agentId} onChange={(event) => { setAgentId(event.target.value); setSelected(null); setEvents([]); }}>
              <option value="">选择 Agent</option>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          </label>
          <span className="conversation-agent-state"><i />{selectedAgent?.status === 'published' ? '已发布' : '可用'}</span>
          {selected && <Link className="conversation-run-link" href={`/runs/${selected.id}`} title="打开运行详情">
            运行详情 <ExternalLink size={15} aria-hidden="true" />
          </Link>}
        </header>

        <main className="conversation-thread" aria-live="polite">
          {!selected ? <div className="conversation-welcome">
            <div className="conversation-welcome-icon"><Bot size={30} aria-hidden="true" /></div>
            <h2>{selectedAgent ? `和 ${selectedAgent.name} 开始对话` : '选择一个 Agent'}</h2>
            <p>{selectedAgent ? '输入任务后，回答和执行状态会显示在这里。' : '选择可用的 Agent 后即可发起会话。'}</p>
          </div> : <div className="conversation-messages">
            <article className="conversation-message is-user">
              <div className="conversation-avatar"><UserRound size={18} aria-hidden="true" /></div>
              <div>
                <span className="conversation-message-author">你</span>
                <div className="conversation-bubble"><p>{promptText(selected) || unrecordedMessage(selected)}</p></div>
              </div>
            </article>
            <article className="conversation-message is-agent">
              <div className="conversation-avatar"><Bot size={18} aria-hidden="true" /></div>
              <div>
                <span className="conversation-message-author">{agents.find((agent) => agent.id === selected.agent_id)?.name || 'Agent'}</span>
                <div className="conversation-bubble">
                  {reply ? <p>{reply}</p> : sending || !['completed', 'failed', 'cancelled', 'stopped'].includes(selected.status)
                    ? <div className="conversation-thinking" role="status"><i /><i /><i /><span>正在处理</span></div>
                    : <p>执行已完成，结构化结果可在运行详情中查看。</p>}
                </div>
                <span className={`conversation-message-status ${selected.status}`}>{displayLabel(selected.status)}</span>
              </div>
            </article>

            {events.length > 0 && <details className="conversation-events">
              <summary>执行进度 · {events.length} 个事件</summary>
              <div className="conversation-event-list">{events.map((item, index) => <div className="conversation-event-row" key={`${item.sequence}-${index}`}>
                <span className="event-name">{item.event}</span>
                <small>#{item.sequence ?? '-'}</small>
              </div>)}</div>
            </details>}
          </div>}
        </main>

        <footer className="conversation-composer-wrap">
          <div className="conversation-composer">
            <label className="sr-only" htmlFor="conversation-message">消息</label>
            <textarea
              ref={textareaRef}
              id="conversation-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={3}
              placeholder="输入消息，Enter 发送，Shift + Enter 换行"
              disabled={sending}
            />
            <button className="conversation-send-button" type="button" disabled={sending || !agentId || !message.trim()} onClick={() => void send()} aria-label="发送消息" title="发送消息">
              <SendHorizontal size={19} aria-hidden="true" />
            </button>
          </div>
          <p>AI 生成内容仅供参考，请核对重要信息。</p>
        </footer>
      </div>
    </section>
  </Workspace>;
}
