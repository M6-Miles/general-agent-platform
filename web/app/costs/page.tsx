"use client";
import { useEffect, useState } from "react";
import Workspace from "../components/Workspace";
import { useAuth } from "../components/AuthProvider";
import { apiBaseUrl, apiRequest } from "../../lib/api";
import ErrorState from "../components/ErrorState";

type Costs = { run_count: number; total_cost_usd: number; total_tokens: number; completed: number; failed: number };
type Usage = { run_count: number; active_runs: number; total_tokens: number; cost_usd: number };
export default function CostsPage() {
  const { token } = useAuth();
  const [costs, setCosts] = useState<Costs | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const load = () => { setError(""); setCosts(null); setUsage(null); if (!token) return; Promise.all([apiRequest<Costs>(apiBaseUrl, "/api/v1/costs/summary", token), apiRequest<Usage>(apiBaseUrl, "/api/v1/tenant/usage", token)]).then(([a, b]) => { setCosts(a.data); setUsage(b.data); }).catch((cause) => setError(String(cause))); };
  useEffect(() => { load(); }, [token]);
  return <Workspace title="成本统计"><section className="catalog-header"><div><h2>成本统计</h2><p>查看当前租户的运行、Token 和成本汇总。</p></div></section>{error ? <ErrorState state="error" error={error} onRetry={load} /> : !costs || !usage ? <ErrorState state="loading" loadingMessage="正在加载成本数据..." /> : <><div className="metric-grid"><article className="metric"><div><span>累计成本 <small>USD</small></span><strong>${costs.total_cost_usd.toFixed(4)}</strong><p>当前租户累计运行成本</p></div></article><article className="metric"><div><span>Token 消耗</span><strong>{costs.total_tokens.toLocaleString("zh-CN")}</strong><p>{usage.active_runs} 个运行中</p></div></article><article className="metric"><div><span>运行次数</span><strong>{costs.run_count.toLocaleString("zh-CN")}</strong><p>完成 {costs.completed} · 失败 {costs.failed}</p></div></article></div><section className="panel"><h2>用量概览</h2><dl className="detail-list"><div><dt>成本</dt><dd>${usage.cost_usd.toFixed(4)}</dd></div><div><dt>Token</dt><dd>{usage.total_tokens.toLocaleString("zh-CN")}</dd></div><div><dt>调用次数</dt><dd>{usage.run_count}</dd></div><div><dt>活跃运行</dt><dd>{usage.active_runs}</dd></div></dl></section></>}</Workspace>;
}
