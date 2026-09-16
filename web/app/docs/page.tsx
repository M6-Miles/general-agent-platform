'use client';

import Link from 'next/link';
import {BookOpen, Code2, FileText, ArrowRight, ShieldCheck, Workflow, Bot} from 'lucide-react';
import '../design-system.css';

const concepts = [
  {title: 'Agent（智能体）', text: '负责执行任务的智能实体，可组合工具、知识库和审批策略。', icon: Bot},
  {title: 'Workflow（工作流）', text: '用有向无环图编排多个节点，支持条件分支和失败恢复。', icon: Workflow},
  {title: 'Run（执行）', text: '每次调用都会产生可追踪的执行记录、输入输出和资源消耗。', icon: FileText},
  {title: 'Tenant（租户）', text: '每个工作区独立隔离数据，适合团队协作和演示环境。', icon: ShieldCheck},
];

export default function DocsPage() {
  return (
    <>
      <header className="docs-header">
        <div className="docs-container docs-header-inner">
          <Link href="/" className="platform-logo"><span className="logo-icon">A</span><span>Agent 平台</span></Link>
          <nav aria-label="文档导航" className="docs-nav">
            <a href="#core-concepts">核心概念</a>
            <a href="#rest-api">API 参考</a>
            <a href="#getting-started">快速开始</a>
          </nav>
          <Link href="/login" className="btn btn-primary docs-login">进入工作台</Link>
        </div>
      </header>

      <main className="docs-container docs-page">
        <section className="docs-hero" aria-labelledby="docs-title">
          <div className="docs-eyebrow">AGENT RUNTIME · DOCUMENTATION</div>
          <h1 id="docs-title">把智能体变成<br /><span>可运行、可审计的系统</span></h1>
          <p>从概念理解到第一次运行，这里提供项目的核心说明、API 示例和本地演示指引。</p>
          <div className="docs-quick-links" aria-label="文档章节快捷入口">
            <a className="docs-quick-card" href="#core-concepts"><BookOpen aria-hidden="true" /><span><strong>核心概念</strong><small>了解 Agent、Workflow 与 Run</small></span><ArrowRight aria-hidden="true" /></a>
            <a className="docs-quick-card" href="#rest-api"><Code2 aria-hidden="true" /><span><strong>API 参考</strong><small>认证、管理与执行接口</small></span><ArrowRight aria-hidden="true" /></a>
            <a className="docs-quick-card" href="#getting-started"><FileText aria-hidden="true" /><span><strong>快速开始</strong><small>使用本地演示账号登录</small></span><ArrowRight aria-hidden="true" /></a>
          </div>
        </section>

        <section id="core-concepts" className="docs-section">
          <div className="docs-section-heading"><div><div className="docs-eyebrow">01 · FOUNDATIONS</div><h2>核心概念</h2></div><p>平台围绕四个核心对象组织能力，所有操作都在当前租户内完成。</p></div>
          <div className="docs-concept-grid">{concepts.map(({title, text, icon: Icon}) => <article key={title} className="docs-concept-card"><div className="docs-concept-icon"><Icon aria-hidden="true" size={20} /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        <section id="agents" className="docs-section docs-section-muted">
          <div className="docs-section-heading"><div><div className="docs-eyebrow">02 · LIFECYCLE</div><h2>从配置到执行</h2></div><p>先创建 Agent，再发布一个版本，最后创建 Run。每一步都有审计记录。</p></div>
          <div className="docs-steps"><div><span>1</span><strong>配置 Agent</strong><p>填写系统指令并绑定工具、知识库。</p></div><div><span>2</span><strong>发布版本</strong><p>锁定可执行定义，保证运行可复现。</p></div><div><span>3</span><strong>执行 Run</strong><p>查看实时状态、输出、Token 和审计事件。</p></div></div>
        </section>

        <section id="rest-api" className="docs-section">
          <div className="docs-section-heading"><div><div className="docs-eyebrow">03 · REST API</div><h2>API 参考</h2></div><a href="http://localhost:8000/docs" target="_blank" rel="noopener" className="docs-inline-link">打开完整 OpenAPI <ArrowRight aria-hidden="true" size={16} /></a></div>
          <div className="docs-api-grid">
            <article className="docs-api-card"><h3>认证</h3><pre>{`POST /api/v1/auth/login
Content-Type: application/json

{
  "tenant_slug": "school-demo",
  "email": "demo-admin@schoolproject.dev",
  "password": "<your-password>"
}`}</pre></article>
            <article className="docs-api-card"><h3>创建 Run</h3><pre>{`POST /api/v1/runs
Authorization: Bearer <access_token>

{
  "agent_id": "agent_xxx",
  "input": {"query": "Hello"}
}`}</pre></article>
          </div>
        </section>

        <section id="getting-started" className="docs-section docs-section-muted docs-start">
          <div><div className="docs-eyebrow">04 · GET STARTED</div><h2>本地演示</h2><p>直接使用预置管理员登录；如果要创建自己的工作区，可在登录页点击“注册一个演示工作区”。</p></div>
          <Link href="/login" className="btn btn-primary">前往登录 <ArrowRight aria-hidden="true" size={18} /></Link>
        </section>
      </main>
    </>
  );
}
