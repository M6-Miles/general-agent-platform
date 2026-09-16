"""Generate the Word usage manual for the Agent platform.

Writes 通用Agent平台-使用说明文档.docx to the internship folder.
"""

from __future__ import annotations

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

OUTPUT = (
    r"C:\木头猪桌面美化(勿删勿移动)99\桌面图标备份(勿删勿移动)\其他文件"
    r"\Desktop\实习（东方国信）\通用Agent平台-使用说明文档.docx"
)

CJK_FONT = "微软雅黑"
MONO_FONT = "Consolas"
ACCENT = RGBColor(0x1F, 0x4E, 0x79)
MUTED = RGBColor(0x59, 0x59, 0x59)


def set_cjk(run, font: str = CJK_FONT) -> None:
    """Word needs an explicit east-asian font hint or CJK falls back to a serif."""
    run.font.name = font
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:ascii"), font)
    rfonts.set(qn("w:hAnsi"), font)
    rfonts.set(qn("w:eastAsia"), font)


def style_base(document: Document) -> None:
    normal = document.styles["Normal"]
    normal.font.size = Pt(10.5)
    normal.font.name = CJK_FONT
    rpr = normal.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia"):
        rfonts.set(qn(attr), CJK_FONT)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.15


def heading(document: Document, text: str, level: int) -> None:
    para = document.add_heading(level=level)
    run = para.add_run(text)
    set_cjk(run)
    run.font.color.rgb = ACCENT
    sizes = {1: 18, 2: 14.5, 3: 12.5}
    run.font.size = Pt(sizes.get(level, 11.5))
    run.font.bold = True


def body(document: Document, text: str, *, italic: bool = False, muted: bool = False):
    para = document.add_paragraph()
    run = para.add_run(text)
    set_cjk(run)
    run.italic = italic
    if muted:
        run.font.color.rgb = MUTED
        run.font.size = Pt(9.5)
    return para


def bullet(document: Document, text: str, *, level: int = 0) -> None:
    para = document.add_paragraph(style="List Bullet")
    para.paragraph_format.left_indent = Pt(18 + level * 16)
    para.paragraph_format.space_after = Pt(3)
    run = para.add_run(text)
    set_cjk(run)


def numbered(document: Document, text: str) -> None:
    para = document.add_paragraph(style="List Number")
    para.paragraph_format.space_after = Pt(3)
    run = para.add_run(text)
    set_cjk(run)


def code(document: Document, lines: list[str]) -> None:
    para = document.add_paragraph()
    para.paragraph_format.left_indent = Pt(18)
    para.paragraph_format.space_before = Pt(4)
    para.paragraph_format.space_after = Pt(8)
    shading = OxmlElement("w:shd")
    shading.set(qn("w:val"), "clear")
    shading.set(qn("w:fill"), "F4F5F7")
    para._p.get_or_add_pPr().append(shading)
    for index, line in enumerate(lines):
        run = para.add_run(line)
        run.font.name = MONO_FONT
        run.font.size = Pt(9.5)
        rpr = run._element.get_or_add_rPr()
        rfonts = rpr.find(qn("w:rFonts"))
        if rfonts is None:
            rfonts = OxmlElement("w:rFonts")
            rpr.append(rfonts)
        for attr in ("w:ascii", "w:hAnsi", "w:eastAsia"):
            rfonts.set(qn(attr), MONO_FONT)
        if index < len(lines) - 1:
            run.add_break()


def table(document: Document, headers: list[str], rows: list[list[str]]) -> None:
    grid = document.add_table(rows=1, cols=len(headers))
    grid.style = "Table Grid"
    grid.alignment = WD_TABLE_ALIGNMENT.CENTER
    for cell, title in zip(grid.rows[0].cells, headers):
        cell.text = ""
        run = cell.paragraphs[0].add_run(title)
        set_cjk(run)
        run.font.bold = True
        run.font.size = Pt(10)
        shading = OxmlElement("w:shd")
        shading.set(qn("w:val"), "clear")
        shading.set(qn("w:fill"), "DCE6F1")
        cell._tc.get_or_add_tcPr().append(shading)
    for row in rows:
        cells = grid.add_row().cells
        for cell, value in zip(cells, row):
            cell.text = ""
            run = cell.paragraphs[0].add_run(value)
            set_cjk(run)
            run.font.size = Pt(9.5)
    document.add_paragraph()


def note(document: Document, text: str) -> None:
    para = document.add_paragraph()
    para.paragraph_format.left_indent = Pt(18)
    para.paragraph_format.space_after = Pt(8)
    shading = OxmlElement("w:shd")
    shading.set(qn("w:val"), "clear")
    shading.set(qn("w:fill"), "FFF8E1")
    para._p.get_or_add_pPr().append(shading)
    run = para.add_run(text)
    set_cjk(run)
    run.font.size = Pt(10)


def build() -> None:
    document = Document()
    style_base(document)

    title = document.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("通用 Agent 平台 使用说明文档")
    set_cjk(run)
    run.font.size = Pt(24)
    run.font.bold = True
    run.font.color.rgb = ACCENT

    meta = document.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = meta.add_run("版本 v1.0　|　编写日期 2026-08-26　|　对应代码版本 0.1.0　|　Alembic b8c9d0e1f2a3")
    set_cjk(run)
    run.font.size = Pt(9.5)
    run.font.color.rgb = MUTED

    body(document, "本文档描述通用 Agent 平台（Auditable Agent Runtime）的启动方式、各页面功能和操作方法。")
    body(document, "文档分为两部分：")
    bullet(document, "第一部分 目前可以实现 —— 已在代码中实现、可实际点击操作的功能。所有描述均基于 web/app 与 app/main.py 的实际代码核对，未实现的不写入。")
    bullet(document, "第二部分 最终产品可以实现 —— 设计文档中已定义、但当前版本尚未落地的能力，作为演进方向。")

    document.add_page_break()

    # ---------------- Part 1 ----------------
    heading(document, "第一部分　目前可以实现", 1)

    heading(document, "1. 启动与登录", 2)
    heading(document, "1.1 启动服务", 3)
    body(document, "平台由 5 个服务组成：api（后端）、worker（任务执行）、postgres、redis、web（前端）。")
    code(document, [
        "# 在项目根目录",
        "Copy-Item .env.example .env      # 首次运行需要",
        "docker compose --profile frontend up --build",
    ])
    body(document, "启动顺序由 Compose 自动编排：postgres → migrate（执行 Alembic 迁移）→ seed（写入演示数据）→ api / worker → web。")
    body(document, "不带 --profile frontend 时只启动后端，前端需另行运行。")

    heading(document, "1.2 访问地址", 3)
    table(document, ["地址", "用途"], [
        ["http://localhost:3000", "前端主工作台（Next.js）"],
        ["http://localhost:8000", "后端 API"],
        ["http://localhost:8000/health", "存活检查，返回 {\"status\":\"ok\"}"],
        ["http://localhost:8000/ready", "就绪检查，返回 {\"status\":\"ready\"}"],
        ["http://localhost:8000/openapi.json", "接口契约"],
        ["http://localhost:8000/metrics", "Prometheus 指标"],
        ["http://localhost:8000/console/", "静态兜底控制台（前端不可用时使用）"],
    ])

    heading(document, "1.3 演示账号", 3)
    body(document, "seed 服务会幂等创建演示租户 demo 和三个账号，密码统一为 ChangeMe123456!：")
    table(document, ["邮箱", "角色", "权限范围"], [
        ["admin@example.com", "tenant_admin", "全部权限，含审批决策与审计导出"],
        ["member@example.com", "member", "可读 Agent、执行 Run、查看审批和审计；不能创建/编辑 Agent，不能做审批决策"],
        ["readonly@example.com", "readonly", "只读 Agent、Run、审计；不能执行 Run"],
    ])
    body(document, "角色与权限的对应关系定义在 web/lib/permissions.ts：")
    table(document, ["权限", "tenant_admin", "member", "readonly"], [
        ["agent:read", "✓", "✓", "✓"],
        ["agent:write", "✓", "—", "—"],
        ["run:read", "✓", "✓", "✓"],
        ["run:execute", "✓", "✓", "—"],
        ["approval:read", "✓", "✓", "—"],
        ["approval:decide", "✓", "—", "—"],
        ["audit:read", "✓", "✓", "✓"],
        ["audit:export", "✓", "—", "—"],
    ])
    note(document, "验收建议：用三个账号分别登录同一页面，观察按钮和入口的显隐差异，这是权限控制的最直接证据。")

    heading(document, "1.4 登录页 /login", 3)
    body(document, "功能：邮箱密码登录，获取 JWT 令牌。")
    body(document, "操作方法：")
    numbered(document, "打开 http://localhost:3000/login，表单已预填 admin@example.com / ChangeMe123456!")
    numbered(document, "点击「登录」")
    numbered(document, "成功后自动跳转到 /dashboard")
    body(document, "实现细节：")
    bullet(document, "令牌与用户信息存入 localStorage（键名 agent_token、agent_user）")
    bullet(document, "支持 ?next= 参数，登录后跳回原目标页")
    bullet(document, "已登录状态下访问 /login 会自动重定向，不会重复登录")
    bullet(document, "登录失败在表单内显示错误码（如 LOGIN_FAILED），带 role=\"alert\"")

    heading(document, "2. 首页 /dashboard", 2)
    body(document, "功能：租户级运营概览，聚合 5 个接口的数据。")
    body(document, "页面内容：")
    table(document, ["区块", "内容", "数据来源"], [
        ["欢迎行", "用户名 + 待审批提醒徽标", "/api/v1/approvals"],
        ["指标卡 × 3", "本月调用次数（含正在运行数）、Token 消耗、本月成本 USD", "/api/v1/tenant/usage"],
        ["我的 Agent", "最近 8 个 Agent 卡片，显示状态、版本号、Skill/Tool 数量", "/api/v1/agents?limit=8"],
        ["最近活动", "最近 5 条审计事件，含操作、资源、结果、时间", "/api/v1/audit?limit=5"],
    ])
    body(document, "操作方法：")
    bullet(document, "Agent 卡片上的「测试」跳转到测试工作台，「编辑」跳转到配置向导（按权限显示）")
    bullet(document, "待审批徽标点击进入审批中心")
    bullet(document, "「查看全部」进入对应的完整列表页")
    body(document, "状态处理：加载时显示骨架屏，失败时显示错误信息与「重试」按钮，无 Agent 时显示空状态引导。")

    heading(document, "3. Agent 列表 /agents", 2)
    body(document, "功能：当前租户全部 Agent 的目录管理。")
    body(document, "操作方法：")
    numbered(document, "搜索：输入框内匹配 Agent 名称、角色、系统指令（前端在当前页数据内过滤）")
    numbered(document, "筛选：按状态下拉筛选（全部 / 草稿 / 测试中 / 已发布 / 已暂停）")
    numbered(document, "排序：最近创建 / 按名称 / 按状态")
    numbered(document, "切换视图：网格视图 ⇄ 列表视图")
    numbered(document, "翻页：底部为 cursor 分页，每页 10 条，支持上一页 / 下一页")
    body(document, "每张卡片显示：Agent 名称、状态徽标、系统指令摘要、完整 Agent ID、版本号、Skill/Tool 数量、更新时间。")
    body(document, "卡片操作（按权限显示）：")
    bullet(document, "「测试」→ /agents/{id}/test，需要 run:execute")
    bullet(document, "「编辑」→ /agents/create?id={id}，需要 agent:write")
    bullet(document, "「版本」→ /agents/{id}/versions，所有角色可见")
    note(document, "注意：搜索和筛选作用于当前页已加载的数据，不是全库检索。这是当前版本的实现边界。")

    heading(document, "4. Agent 配置向导 /agents/create", 2)
    body(document, "功能：7 步引导式创建或编辑 Agent。带 ?id= 参数时进入编辑模式，自动拉取现有配置回填。")
    body(document, "七个步骤：")
    table(document, ["步骤", "名称", "可配置内容"], [
        ["1", "选择模板", "客服助手 / 数据分析助手 / 研究助手 / 从头开始，选择后自动预填名称、说明、Tool"],
        ["2", "基本信息", "Agent 名称、岗位角色、系统指令（多行文本，描述职责与边界）"],
        ["3", "选择能力", "授权 Tool 列表，逗号分隔（如 builtin.echo）"],
        ["4", "配置权限", "权限模式选择（按角色与租户权限 / 继承最小权限）"],
        ["5", "审批策略", "高风险动作需审批 / 所有 Tool 均需审批 / 按 Tool 默认风险"],
        ["6", "入口渠道", "WebChat（平台内测试）或 API（合同接口发起）"],
        ["7", "预览发布", "汇总全部配置，确认后发布"],
    ])
    body(document, "操作方法：")
    bullet(document, "步骤条可点击直接跳转，也可用「上一步」「下一步」顺序推进")
    bullet(document, "任意步骤点「保存草稿」→ 写入浏览器 localStorage，刷新页面不丢失")
    bullet(document, "第 7 步点「发布 Agent」→ 依次调用创建/更新接口 + 发布接口，成功后跳回 /agents")
    bullet(document, "编辑模式下更新使用 If-Match 版本号做乐观锁，防止并发覆盖")
    bullet(document, "创建请求携带 Idempotency-Key，重复提交不会产生重复 Agent")
    body(document, "权限：无 agent:write 的角色（member、readonly）打开此页会看到「无权创建或编辑 Agent」提示页，不渲染表单。")

    heading(document, "5. 测试工作台 /agents/{id}/test", 2)
    body(document, "功能：对单个 Agent 发起真实 Run 并实时观察执行事件流。这是演示主链路最核心的页面。")
    body(document, "操作方法：")
    numbered(document, "在文本框输入任务描述（如「解释一下当前运行时状态」）")
    numbered(document, "点击「发送并运行」，平台依次执行：POST /api/v1/runs 创建 Run（带 Idempotency-Key）→ POST /api/v1/runs/{id}/execute 触发执行 → 建立 SSE 连接订阅 /api/v1/runs/{id}/events")
    numbered(document, "左侧对话区按时间顺序逐条追加事件卡片，每条显示事件类型、序号和完整 JSON 载荷")
    numbered(document, "右侧「运行信息」面板实时显示 Agent 名称、Run ID、已收事件数、最后事件序号")
    body(document, "断点续接：点击「从断点续接」按钮，会带 Last-Event-ID 请求头重连 SSE，从最后收到的序号之后继续接收，不重复不丢事件。这是 Checkpoint / 事件重放机制的前端体现。")
    body(document, "权限：无 run:execute 的角色（readonly）看到「无权执行 Agent」提示页。")
    note(document, "验收建议：这一页最能体现系统的技术深度。发送任务后观察事件序号连续性，然后手动点「从断点续接」验证续传语义。")

    heading(document, "6. Agent 版本管理 /agents/{id}/versions", 2)
    body(document, "功能：查看不可变的历史发布版本，并回滚。")
    body(document, "页面内容：表格列出版本号、发布时间、内容摘要（content_digest 前 12 位）。")
    body(document, "操作方法：")
    bullet(document, "点击某行「回滚到此版本」→ 弹出确认框 → 确认后调用 POST /api/v1/agents/{id}/rollback")
    bullet(document, "回滚不是删除新版本，而是基于历史版本内容创建一个新的发布版本，历史链条完整保留")
    bullet(document, "操作成功后表格自动刷新，并弹出成功通知")
    body(document, "权限：回滚操作列仅对 agent:write 角色显示。")

    heading(document, "7. Skill 管理", 2)
    heading(document, "7.1 创建 Skill /skills/create", 3)
    body(document, "功能：注册能力包（Skill）草稿，支持手工填写或导入 JSON manifest。")
    body(document, "方式一 —— 手工填写：")
    numbered(document, "填写标识 slug（小写字母数字，如 contract-review）、名称、版本（语义化版本号）、入口、许可证")
    numbered(document, "选择风险等级：低 / 中 / 高 / 严重")
    numbered(document, "填写描述，勾选是否产生外部副作用")
    numbered(document, "点「创建草稿」→ 跳转到详情页")
    body(document, "方式二 —— 导入 manifest：")
    numbered(document, "点右上角「导入 Manifest」，选择符合规范的 .json 文件")
    numbered(document, "表单自动回填 id、description、version、entrypoint、license、riskLevel、sideEffects 字段")
    numbered(document, "解析失败会在表单内显示具体错误原因")
    numbered(document, "核对后提交")
    body(document, "校验规则：slug 必须匹配 [a-z0-9][a-z0-9._-]*；版本必须匹配 \\d+\\.\\d+\\.\\d+。")
    body(document, "权限：需要 agent:write。")

    heading(document, "7.2 Skill 详情 /skills/{id}", 3)
    body(document, "功能：查看 Skill 元数据并推进审核状态机。")
    body(document, "页面内容：slug、名称、状态徽标、描述、版本、风险等级、完整内容摘要。")
    body(document, "操作方法（需 agent:write）：")
    bullet(document, "「提交审核」：状态为 draft 或 rejected 时可用，提交后状态变为 pending_review")
    bullet(document, "「驳回」：状态为 pending_review 时可用")
    bullet(document, "「审核发布」：状态为 pending_review 时可用")
    body(document, "按钮按当前状态自动启用 / 禁用，保证状态流转合法。")
    note(document, "已知缺口：左侧导航栏的「Skill 市场」指向 /skills，但该列表页尚未实现（目录下只有 create 和 [id]），点击会得到 404。当前需通过 /skills/create 创建后由跳转进入详情页，或直接输入已知 Skill ID 的 URL 访问。这是待补的页面，不影响后端 Skill 接口的完整性。")

    heading(document, "8. 审批中心 /approvals", 2)
    body(document, "功能：处理 Agent 运行中被拦截的高风险 Tool 调用。")
    body(document, "页面内容：每张审批卡片显示风险图标、状态徽标（待审批 / 已过期）、关联的 Run ID、Tool 调用 ID、到期时间，以及决策快照 ID（如有）。")
    body(document, "操作方法（需 approval:decide）：")
    numbered(document, "在「一次性审批令牌」输入框粘贴 Tool 调用返回的 approval_token")
    numbered(document, "可选填写决策说明")
    numbered(document, "点击「批准」或「拒绝」")
    body(document, "三重安全约束（均为已实现的前端校验）：")
    bullet(document, "令牌长度不足 32 位时，批准和拒绝按钮均禁用")
    bullet(document, "审批已过期（expires_at 早于当前时间）时按钮禁用，徽标显示「已过期」")
    bullet(document, "决策提交后该条从列表移除，令牌输入框清空，防止重复提交")
    body(document, "只读体验：member 角色可以看到待审批列表，但页面顶部会显示「决策操作仅对租户管理员开放」的提示，且不渲染令牌输入框和决策按钮。readonly 角色看到无权访问提示页。")
    body(document, "其他：顶部「刷新」按钮手动重新拉取；底部 cursor 分页，每页 10 条。")

    heading(document, "9. 审计日志 /audit", 2)
    body(document, "功能：查询租户内全部关键操作记录，支持追溯与导出。")
    body(document, "筛选（服务端过滤）：")
    numbered(document, "选择资源类型：Agent / 运行 / Tool 调用 / 审批 / Skill / 认证")
    numbered(document, "输入资源 ID 做精确匹配")
    numbered(document, "点「筛选」应用，点「重置」清空全部条件")
    body(document, "搜索（当前页内过滤）：在「当前结果搜索」框输入关键词，匹配事件名、用户、资源、请求 ID、结果。")
    body(document, "表格字段：时间、用户（系统操作显示「系统」）、事件类型、资源类型 + ID、结果徽标、请求 ID、详情。点击「详情」列的「查看」展开该事件的完整 metadata_json。")
    body(document, "导出（需 audit:export）：点右上角「导出日志」下载 audit.csv，导出期间按钮显示「导出中...」并禁用。")
    body(document, "追溯用法：request_id 字段贯穿一次调用的全链路。在测试工作台执行 Run 后，复制事件中的 request_id 到此页搜索，可串联出该次请求产生的所有审计事件。")

    heading(document, "10. 运行控制台 /", 2)
    body(document, "功能：面向调试的原始接口操作台，所有操作结果以原始 JSON 展示。适合验收时核对接口行为，或前端页面出问题时的兜底通道。")
    table(document, ["面板", "可执行操作"], [
        ["登录", "邮箱密码登录并保存令牌"],
        ["服务状态", "同时探测 /health 和 /ready 并展示原始响应"],
        ["Agent 工坊", "创建 Agent、发布 Agent"],
        ["运行任务", "创建 Run、按 ID 查询 Run、订阅 SSE 事件流"],
        ["审批中心", "加载待审批列表、按 ID 批准 / 拒绝"],
        ["管理数据", "一次性加载 Agent / 审批 / 成本 / 审计四类数据、下载审计 CSV"],
    ])
    body(document, "底部「操作结果」区显示最近一次操作的完整 JSON 响应，错误也会以 JSON 形式展示便于排查。")
    note(document, "另有 http://localhost:8000/console/ 是后端直接托管的静态控制台，不依赖 Next.js 前端，在前端服务未启动时可用。")

    heading(document, "11. 全局交互能力", 2)
    body(document, "以下能力在所有页面统一生效：")
    bullet(document, "导航栏：按当前角色权限过滤入口，当前页高亮（aria-current=\"page\"）")
    bullet(document, "通知系统：操作成功 / 失败弹出提示（NotificationProvider）")
    bullet(document, "焦点管理：路由切换时管理焦点位置（FocusManager），支持键盘导航")
    bullet(document, "无障碍：图标统一 aria-hidden，纯图标按钮带 aria-label，加载态用 role=\"status\"，错误用 role=\"alert\"，表格有完整表头")
    bullet(document, "加载与错误态：列表页统一提供骨架屏、错误重试、空状态引导三种状态")
    bullet(document, "中文本地化：数字用 toLocaleString('zh-CN')，时间用 toLocaleString('zh-CN')，排序用中文 collator")

    heading(document, "12. 完整验收路径", 2)
    body(document, "建议按以下顺序走一遍，覆盖 MVP 定义的演示主链路：")
    code(document, [
        "1.  启动服务，确认 /health 与 /ready 均返回 200",
        "2.  用 admin@example.com 登录 → 进入首页，确认三张指标卡有数据",
        "3.  /agents/create → 选「客服助手」模板 → 走完 7 步 → 发布",
        "4.  /agents → 确认新 Agent 出现，状态为已发布",
        "5.  点「测试」→ 输入任务 → 发送并运行 → 观察 SSE 事件流逐条到达",
        "6.  点「从断点续接」→ 确认事件序号连续，无重复无丢失",
        "7.  /agents/{id}/versions → 确认版本记录 → 执行一次回滚 → 确认生成新版本",
        "8.  /approvals → 若有待审批项，验证令牌长度不足时按钮禁用",
        "9.  /audit → 按资源类型筛选 → 展开详情查看 metadata → 导出 CSV",
        "10. 退出登录，换 member@example.com 登录 → 确认「创建 Agent」入口消失、审批决策区不可见",
        "11. 再换 readonly@example.com → 确认测试工作台显示无权提示",
    ])
    body(document, "第 10、11 步是多租户权限隔离最直观的验收证据，建议重点演示。")

    heading(document, "13. 当前版本的已知限制", 2)
    body(document, "以下为核对代码后确认的实际边界，验收时应明确告知：")
    table(document, ["项", "说明"], [
        ["/skills 列表页缺失", "导航栏「Skill 市场」链接 404，页面文件未创建"],
        ["搜索范围", "Agent 与审计的关键词搜索作用于当前页数据，非全库检索"],
        ["模型提供方", "默认 MODEL_PROVIDER=mock，真实模型需配置 MODEL_API_KEY 后启用"],
        ["Tool 生态", "演示 Tool 仅 builtin.echo，无真实外部工具接入"],
        ["实时通道", "使用 SSE 单向推送，设计文档中的双向 WebSocket 协议尚未实现"],
        ["Docker 构建", "本机 Docker Desktop 存在 BuildKit gRPC 会话错误，已构建镜像可运行，重新构建受阻"],
        ["容量与安全", "k6 压测、镜像漏洞扫描、独立环境备份恢复、渗透测试、RTO/RPO 演练均未执行"],
        ["部分测试", "test_dlq.py、test_runtime.py 依赖容器内 PostgreSQL，宿主机直接运行会连接失败"],
    ])
    body(document, "结论：当前版本为企业级研究型 MVP，核心运行时语义（状态机、Checkpoint、审批、审计、多租户、幂等）可运行、可恢复、可审计、可测试。不具备生产级容量与合规证据，不应标记为生产就绪。")

    document.add_page_break()

    # ---------------- Part 2 ----------------
    heading(document, "第二部分　最终产品可以实现", 1)
    body(document, "以下能力在 project/docs 的设计文档中已有明确定义，属于已规划但当前未落地的部分。按优先级分层。")

    heading(document, "14. 近期可补齐（1-2 周）", 2)
    table(document, ["能力", "目标页面", "设计依据"], [
        ["Skill 市场列表页", "/skills", "按 slug / 名称 / 风险等级 / 状态筛选，卡片展示，一键安装到 Agent"],
        ["Run 历史列表页", "/runs", "当前只能按 ID 查单个 Run，需要租户级 Run 列表、状态筛选、失败原因聚合"],
        ["Run 详情页", "/runs/{id}", "完整事件时间线、Tool 调用链、Checkpoint 列表、成本明细、取消与重放按钮"],
        ["死信队列管理页", "/dlq", "后端 /api/v1/dlq 与重放接口已实现，缺前端界面"],
        ["全库检索", "各列表页", "搜索下推到数据库，替代当前的前端页内过滤"],
        ["Tool 注册界面", "/tools", "后端接口已就绪，当前只能通过 API 注册"],
    ])
    body(document, "这一层的特点是后端接口大多已实现，主要缺前端页面，投入产出比最高。")

    heading(document, "15. 中期演进（1-2 月）", 2)
    heading(document, "双向 WebSocket 实时通道", 3)
    body(document, "替换当前的 SSE 单向推送，实现 04-websocket-protocol-design.md 定义的完整协议：首帧凭据认证、事件补发、心跳保活、断线重连、RESUME_WINDOW_EXPIRED 语义。用户可在运行中实时干预 Agent，而非只能观察。")
    heading(document, "可视化工作流编排器", 3)
    body(document, "当前 workflow 通过 JSON 定义。目标是拖拽式 DAG 编辑器：节点面板（模型 / Tool / 条件 / 人工审批）、连线校验、拓扑环检测、单节点调试、执行态高亮。")
    heading(document, "多模型管理与智能路由", 3)
    body(document, "统一模型接入页，配置多个 Provider 并按成本、延迟、能力自动路由；模型级配额与降级策略；A/B 对比测试。")
    heading(document, "知识库与 RAG", 3)
    body(document, "后端已有 VectorMemory 模型和 pgvector 支持，embeddings.py 已实现向量检索基础。需补：文档上传解析、分块策略配置、检索效果评估、引用溯源展示。")
    heading(document, "成本与配额中心", 3)
    body(document, "从当前的汇总数字扩展为：租户 / Agent / 用户三级配额，预算告警，超限自动暂停，成本趋势图表，账单导出。")

    heading(document, "16. 平台化能力（3-6 月）", 2)
    table(document, ["方向", "内容"], [
        ["渠道接入", "企业微信、钉钉、飞书、Slack、Web SDK 嵌入"],
        ["插件市场", "Skill 打包发布、版本依赖管理、SBOM 与签名校验、社区共享"],
        ["团队协作", "Agent 共享与协作编辑、评论、变更评审流程"],
        ["评测体系", "测试集管理、批量回归、准确率追踪、发布前质量门禁"],
        ["观测增强", "分布式链路追踪、Grafana 仪表盘、异常检测与告警规则"],
        ["生产化部署", "Kubernetes、多副本水平扩展、多地域灾备、蓝绿 / 金丝雀发布"],
    ])

    heading(document, "17. 从当前版本到生产就绪的发布门禁", 2)
    body(document, "按 docs/delivery/current-release-status.md 的发布边界，必须补齐以下证据才能标记为生产完成：")
    numbered(document, "容量：k6 压测报告，HTTP 失败率 < 1%，P95 < 1 秒，附容量模型")
    numbered(document, "安全：镜像漏洞扫描无未处理高危项，SBOM 与镜像签名，渗透测试报告，安全负责人批准")
    numbered(document, "灾备：独立环境备份恢复，恢复后 Run / 审计 / 租户三项一致性检查通过，RTO/RPO 演练记录")
    numbered(document, "发布：版本号、迁移编号、镜像摘要、审批人、监控窗口全部归档")
    numbered(document, "签署：架构、安全、测试、SRE 四方负责人共同签署")
    body(document, "在上述证据齐备前，平台定位保持为研究型 MVP。")

    heading(document, "附录　故障排查", 2)
    table(document, ["现象", "排查方向"], [
        ["前端打不开", "确认使用了 --profile frontend；否则前端服务不会启动"],
        ["登录报错", "检查 docker compose ps 中 seed 是否执行成功；确认 api 状态为 healthy"],
        ["页面数据空白", "打开浏览器控制台看接口响应；确认 .env 的 ALLOWED_ORIGINS 含 http://localhost:3000"],
        ["SSE 事件不推送", "确认 worker 容器在运行；Run 需先调 execute 接口才会产生事件"],
        ["审批按钮点不动", "令牌需满 32 位，且审批未过期；确认当前角色有 approval:decide"],
        ["点「Skill 市场」404", "已知缺口，该列表页未实现"],
        ["镜像构建失败", "Docker Desktop BuildKit gRPC 会话错误，重启 Docker Desktop 或使用已有镜像"],
    ])

    body(document, "本文档基于代码实际实现核对编写。第一部分所有功能均已验证存在对应实现，第二部分为设计文档中已定义的演进方向。", italic=True, muted=True)

    document.save(OUTPUT)
    print(f"Saved: {OUTPUT}")


if __name__ == "__main__":
    build()
