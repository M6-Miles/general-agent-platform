"use client";

import Link from "next/link";
import { ArrowLeft, ChevronDown, GitBranch, History, RefreshCw, RotateCcw, Save, Trash2, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Workspace from "../../components/Workspace";
import ErrorState from "../../components/ErrorState";
import { useAuth } from "../../components/AuthProvider";
import { useConfirm, useNotifier } from "../../components/NotificationProvider";
import { apiBaseUrl, apiRequest, isAbortError } from "../../../lib/api";
import { errorMessage } from "../../../lib/errors";
import { displayLabel } from "../../../lib/labels";
import ToolConfigurationForm, {
  emptyToolConfiguration,
  parseToolConfiguration,
  ToolConfiguration,
  toolConfigurationFrom,
} from "../ToolConfigurationForm";

type Tool = {
  id: string;
  name: string;
  description: string;
  executor: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  side_effects: boolean;
  risk_level: string;
  timeout_ms: number;
  version: number;
  status: string;
  content_digest?: string | null;
  signature_status: string;
};

type ToolCall = {
  id: string;
  run_id: string;
  status: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown> | null;
  error_code: string | null;
  attempt: number;
  created_at: string;
};

type ToolVersion = {
  id: string;
  tool_definition_id: string;
  version: number;
  name: string;
  description: string;
  executor: string;
  risk_level: string;
  timeout_ms: number;
  side_effects: boolean;
  created_by: string;
  created_at: string;
};

export default function ToolDetailPage() {
  const { token, user } = useAuth();
  const notify = useNotifier();
  const confirm = useConfirm();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"overview" | "edit" | "history" | "versions">("overview");
  const [form, setForm] = useState<ToolConfiguration>(emptyToolConfiguration);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [calls, setCalls] = useState<ToolCall[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [versions, setVersions] = useState<ToolVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState("");
  const [rollingBack, setRollingBack] = useState<number | null>(null);
  const canManage = user?.role === "admin" || user?.role === "tenant_admin";

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!token || !params.id) return;
    setLoading(true);
    try {
      const result = await apiRequest<Tool>(apiBaseUrl, `/api/v1/tools/${params.id}`, token, { signal });
      setTool(result.data);
      setError("");
    } catch (cause) {
      if (!isAbortError(cause)) setError(errorMessage(cause, "加载工具失败"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [params.id, token]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const openEditor = () => {
    if (!tool) return;
    setForm(toolConfigurationFrom(tool));
    setFormError("");
    setPanel("edit");
  };

  const loadVersions = async () => {
    if (!token || !tool) return;
    setPanel("versions");
    setVersionsLoading(true);
    setVersionsError("");
    try {
      const result = await apiRequest<ToolVersion[]>(apiBaseUrl, `/api/v1/tools/${tool.id}/versions`, token);
      setVersions(result.data ?? []);
    } catch (cause) {
      setVersionsError(errorMessage(cause, "加载版本历史失败"));
    } finally {
      setVersionsLoading(false);
    }
  };

  const loadCalls = async () => {
    if (!token || !tool) return;
    setPanel("history");
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const result = await apiRequest<ToolCall[]>(apiBaseUrl, `/api/v1/tools/${tool.id}/calls`, token);
      setCalls(result.data ?? []);
    } catch (cause) {
      setHistoryError(errorMessage(cause, "加载调用历史失败"));
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveTool = async () => {
    if (!token || !tool) return;
    const parsed = parseToolConfiguration(form);
    if (parsed.error) {
      setFormError(parsed.error);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const result = await apiRequest<Tool>(apiBaseUrl, `/api/v1/tools/${tool.id}`, token, {
        method: "PATCH",
        headers: { "If-Match": String(tool.version) },
        body: JSON.stringify(parsed.data),
      });
      setTool(result.data);
      setPanel("overview");
      notify("工具配置已保存，版本已更新", "success");
    } catch (cause) {
      setFormError(errorMessage(cause, "保存工具失败"));
      if (cause instanceof Error && "status" in cause && cause.status === 412) {
        setFormError("工具已被其他用户更新，请刷新页面后再试");
      }
    } finally {
      setSaving(false);
    }
  };

  const rollbackTool = async (version: ToolVersion) => {
    if (!token || !tool || version.version === tool.version) return;
    const accepted = await confirm(
      `将恢复 v${version.version} 的完整配置，并创建新的 v${tool.version + 1}。现有版本不会被删除。`,
      `回滚到 v${version.version}`,
    );
    if (!accepted) return;
    setRollingBack(version.version);
    try {
      const result = await apiRequest<Tool>(apiBaseUrl, `/api/v1/tools/${tool.id}/rollback`, token, {
        method: "POST",
        headers: { "If-Match": String(tool.version) },
        body: JSON.stringify({ version: version.version }),
      });
      setTool(result.data);
      notify(`已从 v${version.version} 恢复，并创建 v${result.data.version}`, "success");
      await loadVersions();
    } catch (cause) {
      if (cause instanceof Error && "status" in cause && cause.status === 412) {
        notify("工具已被其他用户更新，请刷新版本历史后再试", "error");
      } else {
        notify(errorMessage(cause, "回滚工具失败"), "error");
      }
    } finally {
      setRollingBack(null);
    }
  };

  const deleteTool = async () => {
    if (!token || !tool) return;
    const accepted = await confirm(
      `删除后，Agent 将不能再调用“${tool.name}”，已有调用记录仍会保留。`,
      "删除工具",
    );
    if (!accepted) return;
    setDeleting(true);
    try {
      await apiRequest(apiBaseUrl, `/api/v1/tools/${tool.id}`, token, { method: "DELETE" });
      notify("工具已删除", "success");
      router.replace("/tools");
    } catch (cause) {
      notify(errorMessage(cause, "删除工具失败"), "error");
      setDeleting(false);
    }
  };

  if (loading) {
    return <Workspace title="工具详情"><ErrorState state="loading" loadingMessage="正在加载工具详情..." /></Workspace>;
  }
  if (!tool) {
    return <Workspace title="工具详情"><ErrorState state="error" error={error || "工具不存在或已被删除"} onRetry={() => void load()} /></Workspace>;
  }

  return (
    <Workspace title="工具详情">
      <div className="skill-detail-layout tool-detail-layout">
        <main className="skill-detail-main">
          <section className="skill-detail-hero">
            <div className="skill-detail-title">
              <span className="skill-icon"><Wrench aria-hidden="true" size={27} /></span>
              <div>
                <span className="eyebrow">{tool.executor}</span>
                <h2>{tool.name}</h2>
                <p>{tool.description || "暂无描述"}</p>
              </div>
              <span className={`badge ${tool.risk_level}`}>{displayLabel(tool.risk_level)}风险</span>
            </div>
            <div className="skill-detail-meta">
              <span>版本 <strong>v{tool.version}</strong></span>
              <span>超时 <strong>{tool.timeout_ms}ms</strong></span>
              <span>{tool.side_effects ? "有外部副作用" : "无外部副作用"}</span>
            </div>
          </section>

          {panel === "overview" && (
            <section className="skill-info-card tool-schema-card">
              <div className="tool-panel-heading">
                <div><h3>数据契约</h3><p>Agent 调用工具时使用的输入和输出 JSON Schema。</p></div>
              </div>
              <div className="tool-schema-grid">
                <div><h4>输入 Schema</h4><pre className="manifest-code">{JSON.stringify(tool.input_schema, null, 2)}</pre></div>
                <div><h4>输出 Schema</h4><pre className="manifest-code">{JSON.stringify(tool.output_schema, null, 2)}</pre></div>
              </div>
            </section>
          )}

          {panel === "edit" && (
            <section className="skill-info-card tool-work-panel" aria-labelledby="tool-edit-title">
              <div className="tool-panel-heading">
                <div><h3 id="tool-edit-title">编辑配置</h3><p>保存后版本号自动递增，并校验当前版本，避免覆盖其他人的修改。</p></div>
                <button className="icon-button" type="button" onClick={() => setPanel("overview")} aria-label="关闭编辑"><X size={18} /></button>
              </div>
              <ToolConfigurationForm value={form} onChange={setForm} disabled={saving} />
              {formError && <p className="tool-form-error" role="alert">{formError}</p>}
              <div className="tool-panel-actions">
                <button className="secondary-button icon-text-button" type="button" onClick={() => setPanel("overview")} disabled={saving}><X size={16} />取消</button>
                <button className="primary-button icon-text-button" type="button" onClick={() => void saveTool()} disabled={saving}><Save size={16} />{saving ? "保存中..." : "保存配置"}</button>
              </div>
            </section>
          )}

          {panel === "history" && (
            <section className="skill-info-card tool-work-panel" aria-labelledby="tool-history-title">
              <div className="tool-panel-heading">
                <div><h3 id="tool-history-title">调用历史</h3><p>最近 50 次调用，包括关联运行、执行状态和已脱敏的输入输出。</p></div>
                <button className="icon-button" type="button" onClick={() => void loadCalls()} aria-label="刷新调用历史" disabled={historyLoading}><RefreshCw size={18} /></button>
              </div>
              {historyLoading ? <ErrorState state="loading" loadingMessage="正在加载调用历史..." /> : historyError ? <ErrorState state="error" error={historyError} onRetry={() => void loadCalls()} /> : calls.length === 0 ? <ErrorState state="empty" emptyIcon={<History size={26} aria-hidden="true" />} emptyTitle="暂无调用记录" emptyDescription="Agent 调用该工具后，记录会显示在这里。" /> : <div className="tool-call-list">{calls.map((call) => <article key={call.id} className="tool-call-item"><div className="tool-call-summary"><span className={`badge ${call.status}`}>{displayLabel(call.status)}</span><Link href={`/runs/${call.run_id}`}>运行 {call.run_id.slice(0, 8)}</Link><time dateTime={call.created_at}>{new Date(call.created_at).toLocaleString("zh-CN")}</time></div><div className="tool-call-meta"><span>第 {call.attempt} 次尝试</span>{call.error_code && <span className="tool-call-error">{call.error_code}</span>}</div><details><summary>查看输入输出 <ChevronDown size={15} /></summary><div className="tool-call-payload"><div><h4>输入</h4><pre>{JSON.stringify(call.input_json, null, 2)}</pre></div><div><h4>输出</h4><pre>{JSON.stringify(call.output_json, null, 2)}</pre></div></div></details></article>)}</div>}
            </section>
          )}

          {panel === "versions" && (
            <section className="skill-info-card tool-work-panel" aria-labelledby="tool-versions-title">
              <div className="tool-panel-heading">
                <div><h3 id="tool-versions-title">版本历史</h3><p>每次注册、编辑和回滚都会保存不可变快照，回滚会生成新版本。</p></div>
                <button className="icon-button" type="button" onClick={() => void loadVersions()} aria-label="刷新版本历史" disabled={versionsLoading}><RefreshCw size={18} /></button>
              </div>
              {versionsLoading ? <ErrorState state="loading" loadingMessage="正在加载版本历史..." /> : versionsError ? <ErrorState state="error" error={versionsError} onRetry={() => void loadVersions()} /> : versions.length === 0 ? <div className="tool-history-empty"><GitBranch size={26} aria-hidden="true" /><strong>暂无版本记录</strong><span>保存工具配置后，版本会显示在这里。</span></div> : <div className="tool-version-list">{versions.map((version) => <div className="tool-version-row" key={version.id}><div className="tool-version-number"><strong>v{version.version}</strong>{version.version === tool.version && <span className="badge active">当前版本</span>}</div><div className="tool-version-summary"><strong>{version.name}</strong><span>{version.executor} · {displayLabel(version.risk_level)}风险 · {version.timeout_ms}ms</span><time dateTime={version.created_at}>{new Date(version.created_at).toLocaleString("zh-CN")}</time></div>{canManage && version.version !== tool.version && <button className="secondary-button icon-text-button" type="button" onClick={() => void rollbackTool(version)} disabled={rollingBack !== null || saving || deleting}><RotateCcw size={15} />{rollingBack === version.version ? "回滚中..." : "回滚到此版本"}</button>}</div>)}</div>}
            </section>
          )}
        </main>

        <aside className="skill-detail-side">
          <section className="governance-card">
            <h3>工具操作</h3>
            <div className="governance-actions">
              {canManage && <button className="primary-button icon-text-button" onClick={openEditor} disabled={saving || deleting}><Wrench aria-hidden="true" size={16} />编辑配置</button>}
              <button className="secondary-button icon-text-button" onClick={() => void loadCalls()} disabled={historyLoading || deleting}><History aria-hidden="true" size={16} />{historyLoading ? "加载中..." : "调用历史"}</button>
              <button className="secondary-button icon-text-button" onClick={() => void loadVersions()} disabled={versionsLoading || deleting}><GitBranch aria-hidden="true" size={16} />{versionsLoading ? "加载中..." : "版本历史"}</button>
              {canManage && <button className="danger-button icon-text-button" onClick={() => void deleteTool()} disabled={deleting || saving}><Trash2 aria-hidden="true" size={16} />{deleting ? "删除中..." : "删除工具"}</button>}
            </div>
            <p className="governance-note">配置更新使用版本校验避免覆盖他人修改；删除采用归档方式，调用审计记录会保留。</p>
          </section>
          <section className="governance-card">
            <h3>基本信息</h3>
            <dl className="governance-list">
              <div><dt>状态</dt><dd>{displayLabel(tool.status)}</dd></div>
              <div><dt>签名</dt><dd>{tool.signature_status}</dd></div>
              {tool.content_digest && <div><dt>摘要</dt><dd title={tool.content_digest}>{tool.content_digest.slice(0, 12)}...</dd></div>}
            </dl>
            <Link className="text-link" href="/tools"><ArrowLeft aria-hidden="true" size={15} />返回工具列表</Link>
          </section>
        </aside>
      </div>
    </Workspace>
  );
}
