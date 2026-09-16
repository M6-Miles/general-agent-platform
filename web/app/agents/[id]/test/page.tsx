"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PlatformHeader from "../../../components/PlatformHeader";
import { useAuth } from "../../../components/AuthProvider";
import { useNotifier } from "../../../components/NotificationProvider";
import { apiBaseUrl, apiRequest } from "../../../../lib/api";
import { can } from "../../../../lib/permissions";
import { Language } from "../../../../lib/i18n";
import Textarea from "../../../components/Textarea";
import "../../../design-system.css";

type Agent = { name: string; status?: string; version?: number; definition: Record<string, unknown> };
type EventItem = { event: string; sequence?: number; data: unknown };
type RunResult = { output_json?: Record<string, unknown> | null; status?: string; usage_json?: Record<string, unknown> };
export default function AgentTest() {
  const { token, user } = useAuth();
  const notify = useNotifier();
  const params = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [prompt, setPrompt] = useState("");
  const [runId, setRunId] = useState("");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [output, setOutput] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const lastEvent = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const [language, setLanguage] = useState<Language>('zh');

  useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    if (token && params.id)
      apiRequest<Agent>(apiBaseUrl, `/api/v1/agents/${params.id}`, token)
        .then((result) => setAgent(result.data))
        .catch(() => undefined);
    return () => abortRef.current?.abort();
  }, [token, params.id, router]);
  async function createRun(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;
    if (!agent || agent.status !== "published") {
      notify("该 Agent 尚未发布，请先发布一个版本后再测试。", "error");
      return;
    }
    setBusy(true);
    setEvents([]);
    setOutput(null);
    try {
      const result = await apiRequest<{ id: string }>(
        apiBaseUrl,
        "/api/v1/runs",
        token,
        {
          method: "POST",
          headers: { "Idempotency-Key": `chat-${crypto.randomUUID()}` },
          body: JSON.stringify({ agent_id: params.id, input: { prompt } }),
        },
      );
      setRunId(result.data.id);
      await apiRequest(
        apiBaseUrl,
        `/api/v1/runs/${result.data.id}/execute?async=true`,
        token,
        { method: "POST" },
      );
      notify("测试 Run 已启动", "success");
      await connect(result.data.id, 0);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      const message = code === "AGENT_VERSION_NOT_PUBLISHED"
        ? "该 Agent 尚未发布，请先发布一个版本后再测试。"
        : `测试运行失败：${code || "请求失败"}`;
      notify(message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function connect(id = runId, after = lastEvent.current) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      if (after > 0) headers["Last-Event-ID"] = String(after);
      const response = await fetch(`${apiBaseUrl}/api/v1/runs/${id}/events`, {
        headers,
        signal: controller.signal,
      });
      if (!response.ok || !response.body)
        throw new Error(`SSE_${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const event = chunk.match(/^event: (.+)$/m)?.[1] ?? "message";
          const dataLine = chunk.match(/^data: (.+)$/m)?.[1];
          if (!dataLine) continue;
          const data = JSON.parse(dataLine) as {
            sequence?: number;
            data?: unknown;
          };
          lastEvent.current = data.sequence ?? lastEvent.current;
          setEvents((current) => [
            ...current,
            { event, sequence: data.sequence, data: data.data },
          ]);
        }
      }
      // The event stream contains lifecycle events only. Fetch the completed
      // Run to display the model/tool output to the user.
      const result = await apiRequest<RunResult>(apiBaseUrl, `/api/v1/runs/${id}`, token);
      setOutput(result.data.output_json ?? null);
    } catch (cause) {
      if (!controller.signal.aborted)
        notify(`事件流连接失败：${cause}`, "error");
    }
  }
  if (user && !can(user.role, "run:execute"))
    return (
      <div>
        <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="agents" />
        <main className="platform-container">
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <h3 className="empty-title">无权执行 Agent</h3>
            <p className="empty-description">当前角色仅能查看 Agent 和历史版本。</p>
          </div>
        </main>
      </div>
    );
  return (
    <div>
      <PlatformHeader language={language} onLanguageChange={handleLanguageChange} activePage="agents" />
      <main className="platform-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              <span className="gradient">测试</span> 工作台
            </h1>
            <p className="page-subtitle">{agent?.name ?? "Agent"} - 消息通过 Run 执行，事件可从断点续接</p>
          </div>
          <button className="btn btn-secondary" onClick={() => router.push(`/agents/${params.id}`)}>
            返回 Agent
          </button>
        </div>

        {agent && agent.status !== "published" && (
          <div className="dashboard-error" role="status" style={{ marginBottom: 'var(--space-6)' }}>
            <p>当前 Agent 还是草稿状态，发布版本后才能创建测试 Run。</p>
            <button className="btn btn-secondary" type="button" onClick={() => router.push(`/agents/${params.id}`)}>前往发布</button>
          </div>
        )}

        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          {runId && (
            <div style={{ padding: 'var(--space-4)', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
              <strong>Run ID:</strong> {runId}
            </div>
          )}

          <div style={{ minHeight: events.length === 0 ? '220px' : '280px', maxHeight: '600px', overflowY: 'auto', padding: 'var(--space-4)', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column' }}>
            {events.length === 0 ? (
              <div className="empty-state" style={{ flex: 1, padding: 'var(--space-6)' }}>
                <div className="empty-icon">💬</div>
                <h3 className="empty-title">{agent?.status === 'published' ? '输入消息开始测试' : '发布后开始测试'}</h3>
                <p className="empty-description">
                  {agent?.status === 'published' ? '运行结果和事件记录会显示在这里' : '当前 Agent 尚未发布版本'}
                </p>
              </div>
            ) : (
              events.map((item, index) => (
                <div
                  key={`${item.sequence}-${index}`}
                  style={{
                    marginBottom: 'var(--space-4)',
                    padding: 'var(--space-4)',
                    background: 'white',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
                    <span className="badge">{item.event}</span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>#{item.sequence}</span>
                  </div>
                  <pre style={{
                    fontSize: '0.875rem',
                    background: 'var(--gray-900)',
                    color: '#d4d4d4',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'auto',
                    margin: 0
                  }}>{JSON.stringify(item.data, null, 2)}</pre>
                </div>
              ))
            )}
          </div>

          {output && (
            <section aria-label="Agent 回答" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <h3 style={{ margin: '0 0 var(--space-3)', fontSize: '1rem' }}>Agent 回答</h3>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{JSON.stringify(output, null, 2)}</pre>
            </section>
          )}

          <form onSubmit={createRun}>
            <Textarea
              label="测试消息"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="向 Agent 描述一个任务..."
              disabled={!agent || agent.status !== 'published'}
            />
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={!runId}
                onClick={() => void connect(runId)}
              >
                从断点续接
              </button>
              <button className="btn btn-primary" disabled={busy || !prompt.trim() || !agent || agent.status !== 'published'}>
                {busy ? "运行中..." : "发送并运行"}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>运行信息</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontWeight: 600 }}>Agent</span>
              <span>{agent?.name ?? "加载中..."}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontWeight: 600 }}>Run ID</span>
              <code>{runId || "尚未创建"}</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontWeight: 600 }}>事件数</span>
              <span>{events.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontWeight: 600 }}>最后序号</span>
              <span>{lastEvent.current || "-"}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
