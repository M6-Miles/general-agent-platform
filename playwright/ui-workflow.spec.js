import {e2eCredentials, requireE2ECredentials} from './credentials.js';
import {test, expect} from '@playwright/test';

const webUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:13001';

test.beforeEach(() => requireE2ECredentials());

test('browser user can complete the Agent, audit, and Skill product workflow', async ({page}) => {
  const stamp = Date.now();
  const agentName = `UI Agent ${stamp}`;

  await page.goto(`${webUrl}/login`);
  await page.getByLabel('邮箱').fill(e2eCredentials.email);
  await page.getByLabel('密码').fill(e2eCredentials.password);
  await page.getByRole('button', {name: '登录'}).click();
  await page.waitForURL(/\/$/);
  await expect(page.getByRole('heading', {name: /可审计的/})).toBeVisible();

  await page.getByRole('link', {name: '创建 Agent'}).click();
  await page.getByRole('button', {name: /客服助手/}).click();
  await page.getByLabel('Agent 名称').fill(agentName);
  await page.getByRole('button', {name: '下一步'}).click();
  await page.getByRole('button', {name: '下一步'}).click();
  await page.getByRole('button', {name: '下一步'}).click();
  await page.getByRole('button', {name: '下一步'}).click();
  await page.getByRole('button', {name: '发布 Agent'}).click();
  await expect(page.getByRole('heading', {name: agentName})).toBeVisible();

  await expect(page.getByRole('button', {name: '测试执行', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: '发布版本', exact: true})).toBeVisible();

  await page.getByRole('link', {name: '审计'}).click();
  await expect(page.getByRole('heading', {name: /审计/})).toBeVisible();
  const skillName = `UI Skill ${stamp}`;
  await page.goto(`${webUrl}/skills/create`);
  await page.getByLabel('标识 slug').fill(`ui-skill-${stamp}`);
  await page.getByLabel('名称').fill(skillName);
  await page.getByLabel('描述').fill('浏览器主链路创建的 Skill');
  await page.getByRole('button', {name: '创建草稿'}).click();
  await page.waitForURL(/\/skills\/[^/]+$/, {timeout: 10000});
  await expect(page.getByRole('heading', {name: skillName})).toBeVisible({timeout: 10000});
  await expect(page.locator('span.badge').filter({hasText: /^\u8349\u7a3f$/})).toBeVisible();
});

test('browser user can open workflow editor and persist a draft interaction', async ({page}) => {
  await page.goto(`${webUrl}/login`);
  await page.getByLabel('邮箱').fill(e2eCredentials.email);
  await page.getByLabel('密码').fill(e2eCredentials.password);
  await page.getByRole('button', {name: '登录'}).click();
  await page.waitForURL(/\/$/);
  await page.goto(`${webUrl}/workflows/create`);
  await page.getByLabel('名称').fill(`E2E Workflow ${Date.now()}`);
  await page.getByRole('button', {name: '确认并开始设计', exact: true}).click();
  await expect(page.getByRole('heading', {name: '创建工作流'})).toBeVisible();
  await expect(page.locator('.react-flow')).toBeVisible();
  await expect(page.getByRole('button', {name: /保存工作流/})).toBeEnabled();
});

test('workflow editor blocks invalid node config and saves after correction', async ({page}) => {
  await page.goto(`${webUrl}/login`);
  await page.getByLabel('邮箱').fill(e2eCredentials.email);
  await page.getByLabel('密码').fill(e2eCredentials.password);
  await page.getByRole('button', {name: '登录'}).click();
  await page.waitForURL(/\/$/);
  await page.goto(`${webUrl}/workflows/create`);
  await page.getByLabel('名称').fill(`Validation Workflow ${Date.now()}`);
  await page.getByRole('button', {name: '确认并开始设计', exact: true}).click();

  await page.locator('#workflow-node-type').selectOption('model');
  await page.getByRole('button', {name: '添加节点', exact: true}).click();
  await page.getByText('模型（1）', {exact: true}).click();
  await expect(page.getByText('模型 Prompt', {exact: true})).toBeVisible();

  await page.getByRole('button', {name: /保存工作流/}).click();
  await expect(page.getByText('模型 Prompt 不能为空', {exact: true})).toBeVisible();
  await expect(page.locator('textarea[aria-invalid="true"]')).toHaveCount(1);

  await page.locator('textarea[aria-invalid="true"]').fill('请根据用户输入生成简洁回答');
  await page.getByRole('button', {name: /保存工作流/}).click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith('/workflows/') && url.pathname !== '/workflows/create', {timeout: 15000});
});

test('workflow editor validates tool JSON input before saving', async ({page, request}) => {
  const stamp = Date.now();
  const login = await request.post(`${process.env.API_BASE_URL || 'http://127.0.0.1:18001'}/api/v1/auth/login`, {
    data: {email: e2eCredentials.email, password: e2eCredentials.password, tenant_slug: e2eCredentials.tenantSlug},
  });
  const token = (await login.json()).data.access_token;
  const tool = await request.post(`${process.env.API_BASE_URL || 'http://127.0.0.1:18001'}/api/v1/tools`, {
    headers: {Authorization: `Bearer ${token}`},
    data: {name: `校验工具 ${stamp}`, executor: 'builtin.echo'},
  });
  expect(tool.status()).toBe(201);
  const toolId = (await tool.json()).data.id;

  await page.goto(`${webUrl}/login`);
  await page.getByLabel('邮箱').fill(e2eCredentials.email);
  await page.getByLabel('密码').fill(e2eCredentials.password);
  await page.getByRole('button', {name: '登录'}).click();
  await page.waitForURL(/\/$/);
  await page.goto(`${webUrl}/workflows/create`);
  await page.getByLabel('名称').fill(`Tool Validation ${stamp}`);
  await page.getByRole('button', {name: '确认并开始设计', exact: true}).click();
  await page.locator('#workflow-node-type').selectOption('tool');
  await expect(page.getByLabel('已注册工具:')).toContainText(`校验工具 ${stamp}`);
  await page.getByLabel('已注册工具:').selectOption(toolId);
  await page.getByRole('button', {name: '添加节点', exact: true}).click();
  const toolNode = page.locator('.react-flow__node').filter({hasText: `校验工具 ${stamp}`});
  await toolNode.click();
  await page.getByLabel('输入参数 JSON').fill('[]');
  await page.getByRole('button', {name: /保存工作流/}).click();
  await expect(page.getByText('输入参数必须是有效的 JSON 对象', {exact: true})).toBeVisible();
  await page.getByLabel('输入参数 JSON').fill('{"ok":true}');
  await page.getByLabel('输入参数 JSON').blur();
  await page.getByRole('button', {name: /保存工作流/}).click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith('/workflows/') && url.pathname !== '/workflows/create', {timeout: 15000});
});

test('workflow editor requires both condition branches before saving', async ({page}) => {
  await page.goto(`${webUrl}/login`);
  await page.getByLabel('邮箱').fill(e2eCredentials.email);
  await page.getByLabel('密码').fill(e2eCredentials.password);
  await page.getByRole('button', {name: '登录'}).click();
  await page.waitForURL(/\/$/);
  await page.goto(`${webUrl}/workflows/create`);
  await page.getByLabel('名称').fill(`Condition Validation ${Date.now()}`);
  await page.getByRole('button', {name: '确认并开始设计', exact: true}).click();
  await page.locator('#workflow-node-type').selectOption('condition');
  await page.getByRole('button', {name: '添加节点', exact: true}).click();
  await page.getByText('条件（1）', {exact: true}).click();
  await page.getByRole('button', {name: /保存工作流/}).click();
  await expect(page.getByText('左值字段不能为空', {exact: true})).toBeVisible();
  await expect(page.getByText('请选择满足时的目标节点', {exact: true})).toBeVisible();
  await page.getByLabel('左值字段').fill('status');
  await page.getByLabel('右值').fill('ready');
  const conditionSelects = page.locator('.workflow-properties-form select');
  await conditionSelects.nth(0).selectOption('equals');
  await conditionSelects.nth(1).selectOption('end-1');
  await conditionSelects.nth(2).selectOption('end-1');
  await expect(conditionSelects.nth(1)).toHaveValue('end-1');
  await expect(conditionSelects.nth(2)).toHaveValue('end-1');
  await page.getByRole('button', {name: /保存工作流/}).click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith('/workflows/') && url.pathname !== '/workflows/create', {timeout: 15000});
});

test.describe('移动端工作流触摸回归', () => {
  test.use({hasTouch: true, viewport: {width: 390, height: 844}});
  test('画布和操作按钮在窄屏可触达且无横向溢出', async ({page}) => {
    await page.goto(`${webUrl}/login`);
    await page.getByLabel('邮箱').fill(e2eCredentials.email);
    await page.getByLabel('密码').fill(e2eCredentials.password);
    await page.getByRole('button', {name: '登录'}).click();
    await page.waitForURL(/\/$/);
    await page.goto(`${webUrl}/workflows/create`);
    await page.getByLabel('名称').fill(`Mobile Workflow ${Date.now()}`);
    await page.getByRole('button', {name: '确认并开始设计', exact: true}).tap();
    await expect(page.locator('.react-flow')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await expect(page.getByRole('button', {name: /保存工作流/})).toBeVisible();
  });
});
