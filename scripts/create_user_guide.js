const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } = require('docx');

const outputDir = 'C:\\木头猪桌面美化(勿删勿移动)99\\桌面图标备份(勿删勿移动)\\其他文件\\Desktop\\实习（东方国信）';
fs.mkdirSync(outputDir, { recursive: true });
const file = path.join(outputDir, '通用Agent平台使用指南.docx');
const bullet = (text) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun(text)] });
const step = (text) => new Paragraph({ numbering: { reference: 'steps', level: 0 }, children: [new TextRun(text)] });
const code = (text) => new Paragraph({ shading: { fill: 'F2F4F7', type: ShadingType.CLEAR }, children: [new TextRun({ text, font: 'Consolas', size: 20 })] });
const doc = new Document({
  numbering: { config: [
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ] },
  styles: { default: { document: { run: { font: 'Microsoft YaHei', size: 22 } } }, paragraphStyles: [
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Microsoft YaHei', size: 32, bold: true }, paragraph: { spacing: { before: 300, after: 180 }, outlineLevel: 0 } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Microsoft YaHei', size: 26, bold: true }, paragraph: { spacing: { before: 240, after: 140 }, outlineLevel: 1 } },
  ] },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 } } }, children: [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: '通用 Agent 平台使用指南', bold: true, size: 40, font: 'Microsoft YaHei' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '本地开发与功能验收手册', color: '667085', size: 24 })] }),
    new Paragraph({ spacing: { before: 300, after: 300 }, children: [new TextRun('适用项目：东方国信通用 Agent 平台\n适用环境：Windows + Docker Desktop + 本地浏览器\n更新时间：2026-08-31')] }),
    new Paragraph({ text: '目录', heading: HeadingLevel.HEADING_1 }),
    bullet('一、启动平台'), bullet('二、登录与权限'), bullet('三、Agent 管理'), bullet('四、Run 运行与调试'), bullet('五、知识库与 RAG'), bullet('六、工作流编辑与实例'), bullet('七、Skill 管理'), bullet('八、审批与审计'), bullet('九、常见问题'),
    new Paragraph({ text: '一、启动平台', heading: HeadingLevel.HEADING_1 }),
    new Paragraph('启动前确认 Docker Desktop 已运行，并在项目根目录打开 PowerShell。'),
    code('cd "D:\\study\\mzx\\项目\\东方国信\\通用agent平台"\ndocker compose up -d\ndocker compose ps'),
    new Paragraph('如需监控服务：'), code('docker compose --profile monitoring up -d'),
    bullet('前端地址：http://localhost:3000'), bullet('API 健康检查：http://localhost:8000/health'), bullet('Prometheus：http://localhost:9090'), bullet('Grafana：http://localhost:3002'),
    new Paragraph({ text: '二、登录与权限', heading: HeadingLevel.HEADING_1 }),
    new Paragraph('打开前端登录页，使用以下本地种子账号：'),
    new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3000, 3000, 3360], rows: [
      new TableRow({ children: ['角色', '账号', '密码'].map((text, i) => new TableCell({ width: { size: [3000, 3000, 3360][i], type: WidthType.DXA }, shading: { fill: 'D9EAF7', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })) }),
      ...[['租户管理员', 'admin@example.com', 'ChangeMe123456!'], ['普通成员', 'member@example.com', 'ChangeMe123456!'], ['只读用户', 'readonly@example.com', 'ChangeMe123456!']].map((row) => new TableRow({ children: row.map((text, i) => new TableCell({ width: { size: [3000, 3000, 3360][i], type: WidthType.DXA }, children: [new Paragraph(text)] })) })),
    ] }),
    bullet('管理员可以创建、编辑、发布 Agent，并处理审批。'), bullet('只读用户只能查看授权数据，不能执行写操作。'), bullet('所有资源按租户隔离，跨租户访问应返回 404。'),
    new Paragraph({ text: '三、Agent 管理', heading: HeadingLevel.HEADING_1 }),
    step('进入“Agent”页面，点击“创建 Agent”。'), step('选择模板，填写名称、岗位角色和系统指令。'), step('在“选择能力”中填写允许使用的 Tool，例如 builtin.echo。'), step('配置审批策略、运行入口和预算。'), step('进入预览页，点击“发布 Agent”。'),
    new Paragraph('发布后可在 Agent 卡片中进入测试、编辑、版本管理或删除。删除为软删除，历史 Run、版本和审计记录仍保留。'),
    new Paragraph({ text: '四、Run 运行与调试', heading: HeadingLevel.HEADING_1 }),
    new Paragraph('进入 Agent 的“测试”页面输入消息，平台会创建 Run 并通过 SSE 展示事件时间线。Run 详情页支持：'), bullet('查看状态、成本、Checkpoint 和事件。'), bullet('SSE 断线后从最后事件序号恢复。'), bullet('取消运行、失败重放和 Checkpoint 恢复。'),
    new Paragraph({ text: '五、知识库与 RAG', heading: HeadingLevel.HEADING_1 }),
    step('进入“知识库”，创建知识库并填写标识和名称。'), step('在“导入文档”中选择文本、Markdown、JSON、PDF 或 DOCX 文件。'), step('点击“上传并索引”，系统会自动解析、分块并建立向量索引。'), step('在“语义检索”输入问题并搜索。'), step('创建 Run 时在输入中指定 knowledge_base_id，检索结果会注入执行上下文。'),
    new Paragraph({ text: '六、工作流编辑与实例', heading: HeadingLevel.HEADING_1 }),
    new Paragraph('进入“工作流”页面，可拖拽 ReactFlow 节点、通过句柄建立连线并保存草稿。工作流实例 API 会创建并绑定实际 Run，实例列表展示状态和 Run ID。'),
    code('GET  /api/v1/workflows\nPUT  /api/v1/workflows/{workflow_id}\nPOST /api/v1/workflow-instances\nGET  /api/v1/workflow-instances\nPOST /api/v1/workflow-instances/{instance_id}/cancel'),
    new Paragraph({ text: '七、Skill 管理', heading: HeadingLevel.HEADING_1 }),
    step('进入“Skill 市场”，浏览当前租户的能力包。'), step('点击“创建 Skill”，填写 slug、名称、版本、入口、许可证和风险等级。'), step('可导入 JSON Manifest，提交后由管理员审核。'), step('审核通过后 Skill 才能发布和被 Agent 使用。'),
    new Paragraph({ text: '八、审批与审计', heading: HeadingLevel.HEADING_1 }),
    new Paragraph('高风险 Tool 调用会进入“审批中心”。管理员输入一次性审批令牌后批准或拒绝。所有创建、发布、运行、审批、删除和导出操作都会写入“审计日志”，可按资源类型、资源 ID 和关键字筛选，并导出 CSV。'),
    new Paragraph({ text: '九、常见问题', heading: HeadingLevel.HEADING_1 }),
    bullet('页面仍打开 3000 端口：确认访问的是 http://localhost:3000，旧进程未停止时不要重复终止。'),
    bullet('API 不健康：执行 docker compose ps 和 docker compose logs api，确认迁移已完成。'),
    bullet('登录失败：先执行 python scripts/seed.py，确保本地种子账号存在。'),
    bullet('上传失败：检查文件大小不超过 2 MiB、格式受支持且文件内容未损坏。'),
    bullet('监控页面打不开：使用 docker compose --profile monitoring up -d 启动 Prometheus/Grafana。'),
    new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: '说明：生产级压测、镜像漏洞扫描、签名验签和跨地域灾备属于发布环境门禁，不应以本地开发结果替代。', italics: true, color: '667085' })] }),
  ] }],
});
Packer.toBuffer(doc).then((buffer) => fs.writeFileSync(file, buffer)).then(() => console.log(file));
