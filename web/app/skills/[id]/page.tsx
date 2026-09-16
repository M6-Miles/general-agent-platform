'use client';

import Link from 'next/link';
import {ArrowLeft, CheckCircle2, FileCode2, Send, ShieldCheck, XCircle} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {useParams} from 'next/navigation';
import Workspace from '../../components/Workspace';
import {useAuth} from '../../components/AuthProvider';
import {useNotifier} from '../../components/NotificationProvider';
import {apiBaseUrl, apiRequest, isAbortError} from '../../../lib/api';
import {can} from '../../../lib/permissions';
import {displayLabel} from '../../../lib/labels';
import ErrorState from '../../components/ErrorState';
import {errorMessage} from '../../../lib/errors';

type Skill = {id: string; name: string; slug: string; description: string; version: string; status: string; manifest_json: Record<string, unknown>; content_digest: string};

export default function SkillDetail() {
  const {token, user} = useAuth();
  const notify = useNotifier();
  const params = useParams<{id: string}>();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [error, setError] = useState(''); const controller = useRef<AbortController | null>(null);
  const canWrite = can(user?.role, 'agent:write');
  const load = () => { let active = true; controller.current?.abort(); controller.current = new AbortController(); if (token && params.id) apiRequest<Skill>(apiBaseUrl, `/api/v1/skills/${params.id}`, token, {signal: controller.current.signal}).then((result) => { if (active) { setError(''); setSkill(result.data); } }).catch((cause) => { if (active && !isAbortError(cause)) setError(errorMessage(cause, '加载 Skill 失败')); }); return () => { active = false; controller.current?.abort(); }; };
  useEffect(() => load(), [token, params.id]);
  async function submit() { try { const result = await apiRequest<Skill>(apiBaseUrl, `/api/v1/skills/${params.id}/submit`, token, {method: 'POST'}); setSkill(result.data); notify('Skill 已提交审核', 'success'); } catch (cause) { const message = String(cause); setError(message); notify(`提交失败：${message}`, 'error'); } }
  async function review(decision: 'approve' | 'reject') { try { const result = await apiRequest<Skill>(apiBaseUrl, `/api/v1/skills/${params.id}/review`, token, {method: 'POST', body: JSON.stringify({decision, reason: decision === 'approve' ? '' : '需要补充安全说明'})}); setSkill(result.data); notify(decision === 'approve' ? 'Skill 已审核发布' : 'Skill 已驳回', 'success'); } catch (cause) { const message = String(cause); setError(message); notify(`审核失败：${message}`, 'error'); } }
  return <Workspace title="Skill 详情">{skill ? <div className="skill-detail-layout"><main className="skill-detail-main"><section className="skill-detail-hero"><div className="skill-detail-title"><span className="skill-icon"><FileCode2 aria-hidden="true" size={27} /></span><div><span className="eyebrow">{skill.slug}</span><h2>{skill.name}</h2><p>{skill.description || '暂无描述'}</p></div><span className={`badge ${skill.status}`}>{displayLabel(skill.status)}</span></div><div className="skill-detail-meta"><span>版本 <strong>{skill.version}</strong></span><span>风险 <strong>{displayLabel(String(skill.manifest_json.riskLevel ?? 'low'))}</strong></span><span>{Boolean(skill.manifest_json.sideEffects) ? '有外部副作用' : '无外部副作用'}</span></div></section><section className="skill-info-card"><h3>Manifest 配置</h3><pre className="manifest-code">{JSON.stringify(skill.manifest_json, null, 2)}</pre></section><section className="skill-info-card"><h3>内容摘要</h3><p className="hint">该 Skill 的内容摘要按内容摘要固定标识，用于审计和版本校验。</p><code>{skill.content_digest}</code></section></main><aside className="skill-detail-side"><section className="governance-card"><h3>审核与发布</h3><div className="governance-actions">{canWrite && <button className="icon-text-button" onClick={() => void submit()} disabled={!['draft', 'rejected'].includes(skill.status)}><Send aria-hidden="true" size={16} />提交审核</button>}{canWrite && <button className="secondary-button icon-text-button" onClick={() => void review('approve')} disabled={skill.status !== 'pending_review'}><CheckCircle2 aria-hidden="true" size={16} />审核发布</button>}{canWrite && <button className="danger-button icon-text-button" onClick={() => void review('reject')} disabled={skill.status !== 'pending_review'}><XCircle aria-hidden="true" size={16} />驳回</button>}</div><p className="governance-note"><ShieldCheck aria-hidden="true" size={15} /> 所有状态变更都会记录审计事件。</p></section><section className="governance-card"><h3>基本信息</h3><dl className="governance-list"><div><dt>标识</dt><dd>{skill.slug}</dd></div><div><dt>当前状态</dt><dd>{displayLabel(skill.status)}</dd></div><div><dt>内容摘要</dt><dd>{skill.content_digest.slice(0, 12)}...</dd></div></dl><Link className="text-link" href="/skills"><ArrowLeft aria-hidden="true" size={15} />返回 Skill 市场</Link></section></aside></div> : error ? <ErrorState state="error" error={error} onRetry={() => void load()} /> : <ErrorState state="loading" />}</Workspace>;
}
