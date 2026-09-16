import AxeBuilder from '@axe-core/playwright';
import {test, expect} from '@playwright/test';
import {e2eCredentials, requireE2ECredentials} from './credentials.js';

const webUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:13001';
const apiUrl = process.env.API_BASE_URL || 'http://127.0.0.1:18001';

async function expectApi(response, status) {
  expect(response.status(), await response.text()).toBe(status);
  return response.json();
}

async function expectNoSeriousAccessibilityIssues(page) {
  const result = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const violations = result.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical');
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test('approval, manifest upload, CSV export, mobile layout, and accessibility regression', async ({page, request}) => {
  requireE2ECredentials();
  const stamp = Date.now();
  const login = await expectApi(await page.context().request.post(`${apiUrl}/api/v1/auth/login`, {data: {email: e2eCredentials.email, password: e2eCredentials.password, tenant_slug: e2eCredentials.tenantSlug}}), 200);
  const token = login.data.access_token;
  const headers = {Authorization: `Bearer ${token}`};
  await page.addInitScript(() => localStorage.setItem('auth_session_hint', '1'));

  await test.step('approve a real high-risk Tool Call', async () => {
    const toolName = `ui-dangerous-${stamp}`;
    await expectApi(await request.post('/api/v1/tools', {headers, data: {name: toolName, executor: 'builtin.echo', risk_level: 'high'}}), 201);
    const agent = await expectApi(await request.post('/api/v1/agents', {headers, data: {name: `Approval Agent ${stamp}`, definition: {workflow: []}}}), 201);
    await expectApi(await request.post(`/api/v1/agents/${agent.data.id}/publish`, {headers}), 201);
    const run = await expectApi(await request.post('/api/v1/runs', {headers, data: {agent_id: agent.data.id, input: {source: 'ui-approval-test'}}}), 202);
    const call = await expectApi(await request.post(`/api/v1/runs/${run.data.id}/tool-calls`, {headers, data: {tool_name: toolName, input: {value: 'approved'}, idempotency_key: `ui-approval-${stamp}`}}), 202);
    await expectApi(await request.post(`/api/v1/runs/${run.data.id}/execute`, {headers}), 202);

    await page.goto(`${webUrl}/approvals`);
    const approval = page.locator(`.approval-item[data-run-id="${run.data.id}"]`);
    await expect(approval).toBeVisible();
    await page.locator(`.approval-item[data-run-id="${run.data.id}"]`).getByRole('button', {name: '批准'}).click();
    const tokenDialog = page.getByRole('dialog');
    await expect(tokenDialog).toBeVisible();
    await tokenDialog.locator('.ui-dialog-input').fill(call.data.approval_token);
    await tokenDialog.getByRole('button', {name: '确定'}).click();
    const reasonDialog = page.getByRole('dialog');
    await expect(reasonDialog).toBeVisible();
    await reasonDialog.locator('.ui-dialog-input').fill('专项 UI 验收通过');
    await reasonDialog.getByRole('button', {name: '确定'}).click();
    await expect(approval).toHaveCount(0);
    const pending = await expectApi(await request.get('/api/v1/approvals', {headers}), 200);
    expect(pending.data.some((item) => item.run_id === run.data.id)).toBeFalsy();
  });

  await test.step('import a JSON manifest and create a Skill', async () => {
    const slug = `uploaded-skill-${stamp}`;
    await page.goto(`${webUrl}/skills/create`);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'skill-manifest.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({id: slug, version: '2.3.0', description: '由 Manifest 文件导入', entrypoint: 'handlers.main', license: 'Apache-2.0', riskLevel: 'high', sideEffects: true, capabilities: ['review']})),
    });
    await expect(page.getByText(/已导入.*skill-manifest\.json/)).toBeVisible();
    await expect(page.getByLabel('标识 slug')).toHaveValue(slug);
    await expect(page.getByLabel('版本')).toHaveValue('2.3.0');
    await expect(page.getByLabel('风险等级')).toHaveValue('high');
    await expect(page.getByLabel('该 Skill 会产生外部副作用')).toBeChecked();
    await page.getByLabel('名称').fill(`Uploaded Skill ${stamp}`);
    await page.getByRole('button', {name: '创建草稿'}).click();
    await expect(page.getByText('Skill 草稿已创建')).toBeVisible();
  });

  await test.step('download and validate the audit CSV', async () => {
    await page.goto(`${webUrl}/audit`);
    await expect(page.getByRole('heading', {name: /审计/})).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', {name: '导出日志'}).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('audit.csv');
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const csv = Buffer.concat(chunks).toString('utf8');
    expect(csv).toContain('event_id,tenant_id,actor_id,action,resource_type,resource_id,request_id,outcome,created_at');
    expect(csv).toContain('approval.approved');
    expect(csv).toContain('skill.created');
  });

  await test.step('check mobile overflow and key accessibility rules', async () => {
    await page.setViewportSize({width: 390, height: 844});
    for (const path of ['/dashboard', '/approvals', '/audit', '/skills/create']) {
      await page.goto(`${webUrl}${path}`);
      await expect(page.locator('main.workspace, main.platform-container').first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      await expectNoSeriousAccessibilityIssues(page);
    }
  });
});
