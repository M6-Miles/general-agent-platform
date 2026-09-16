import {e2eCredentials, requireE2ECredentials} from './credentials.js';
import {test, expect} from '@playwright/test';

const webUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:13001';
const apiUrl = process.env.API_BASE_URL || 'http://127.0.0.1:18001';

async function login(request, email = e2eCredentials.email) {
  requireE2ECredentials();
  const response = await request.post('/api/v1/auth/login', {data: {email, password: e2eCredentials.password, tenant_slug: e2eCredentials.tenantSlug}});
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).data;
}

async function authenticatedPage(browser, session) {
  const context = await browser.newContext();
  const freshLogin = await context.request.post(`${apiUrl}/api/v1/auth/login`, {data: {email: session.user.email, password: e2eCredentials.password, tenant_slug: e2eCredentials.tenantSlug}});
  expect(freshLogin.ok(), await freshLogin.text()).toBeTruthy();
  await context.addInitScript(() => localStorage.setItem('auth_session_hint', '1'));
  const page = await context.newPage();
  return {context, page};
}

test('Run 详情支持断点续接、操作权限和移动端布局', async ({browser, request}) => {
  requireE2ECredentials();
  const stamp = Date.now();
  const admin = await login(request);
  const headers = {Authorization: `Bearer ${admin.access_token}`};
  const toolName = `detail-wait-${stamp}`;
  expect((await request.post('/api/v1/tools', {headers, data: {name: toolName, executor: 'builtin.echo', risk_level: 'high'}})).status()).toBe(201);
  const agentResponse = await request.post('/api/v1/agents', {headers, data: {name: `详情 UI Agent ${stamp}`, definition: {workflow: [{key: 'wait', type: 'tool', tool_name: toolName, input: {value: 'wait'}}]}}});
  expect(agentResponse.status()).toBe(201);
  const agent = (await agentResponse.json()).data;
  expect((await request.post(`/api/v1/agents/${agent.id}/publish`, {headers})).status()).toBe(201);
  const runResponse = await request.post('/api/v1/runs', {headers, data: {agent_id: agent.id, input: {source: 'detail-ui'}}});
  let run;
  if (runResponse.status() === 202) run = (await runResponse.json()).data;
  else {
    expect(runResponse.status(), await runResponse.text()).toBe(429);
    const existing = await request.get('/api/v1/runs?limit=1', {headers});
    expect(existing.status(), await existing.text()).toBe(200);
    run = (await existing.json()).data[0];
  }
  expect(run?.id).toBeTruthy();

  const {context, page} = await authenticatedPage(browser, admin);
  const seenLastIds = [];
  await page.route(`**/api/v1/runs/${run.id}/events`, async (route) => {
    seenLastIds.push(route.request().headers()['last-event-id'] || '');
    await route.fulfill({status: 200, headers: {'content-type': 'text/event-stream'}, body: 'id: event-1\nevent: progress\ndata: {"sequence":1,"event_id":"event-1","data":{"step":"开始"}}\n\n'});
  });

  await page.goto(`${webUrl}/runs/${run.id}`);
  await expect(page.getByRole('heading', {name: '运行详情'})).toBeVisible();
  await expect(page.getByText(run.id)).toBeVisible();
  await expect(page.getByText('事件时间线')).toBeVisible();
  await expect(page.getByText('progress')).toBeVisible();
  await expect(page.getByText('开始')).toBeVisible();
  await expect(page.getByRole('button', {name: '取消运行'})).toBeVisible();
  await expect(page.getByRole('button', {name: '重放'})).toHaveCount(0);
  // Checkpoints may be persisted for failed runs, making recovery available.
  await page.getByRole('button', {name: '从断点续接'}).click();
  await expect.poll(() => seenLastIds.length).toBeGreaterThanOrEqual(2);
  expect(seenLastIds.at(-1)).toBe('1');

  await page.setViewportSize({width: 390, height: 844});
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await context.close();

  const readonly = await login(request, 'readonly@example.com');
  const readonlyPage = await authenticatedPage(browser, readonly);
  await readonlyPage.page.goto(`${webUrl}/runs/${run.id}`);
  await expect(readonlyPage.page.getByRole('heading', {name: '运行详情'})).toBeVisible();
  await expect(readonlyPage.page.getByRole('button', {name: '取消运行'})).toHaveCount(0);
  await expect(readonlyPage.page.getByRole('button', {name: '重放'})).toHaveCount(0);
  await expect(readonlyPage.page.getByRole('button', {name: '恢复'})).toHaveCount(0);
  await readonlyPage.context.close();
});

test('Run 取消成功后刷新摘要、通知和事件时间线', async ({browser, request}) => {
  const stamp = Date.now();
  const admin = await login(request);
  const headers = {Authorization: `Bearer ${admin.access_token}`};
  const toolName = `cancel-wait-${stamp}`;
  expect((await request.post('/api/v1/tools', {headers, data: {name: toolName, executor: 'builtin.echo', risk_level: 'high'}})).status()).toBe(201);
  const agentResponse = await request.post('/api/v1/agents', {headers, data: {name: `取消刷新 Agent ${stamp}`, definition: {workflow: [{key: 'wait', type: 'tool', tool_name: toolName, input: {value: 'wait'}}]}}});
  expect(agentResponse.status()).toBe(201);
  const agent = (await agentResponse.json()).data;
  expect((await request.post(`/api/v1/agents/${agent.id}/publish`, {headers})).status()).toBe(201);
  const created = await request.post('/api/v1/runs', {headers, data: {agent_id: agent.id, input: {source: 'cancel-refresh'}}});
  let run;
  if (created.status() === 202) run = (await created.json()).data;
  else {
    expect(created.status()).toBe(429);
    const active = await request.get('/api/v1/runs?status=accepted&limit=1', {headers});
    expect(active.status()).toBe(200);
    run = (await active.json()).data[0];
  }
  expect(run?.id).toBeTruthy();

  const {context, page} = await authenticatedPage(browser, admin);
  await page.goto(`${webUrl}/runs/${run.id}`);
  await expect(page.getByRole('button', {name: '取消运行'})).toBeVisible();
  await page.getByRole('button', {name: '取消运行'}).click();
  await page.getByRole('dialog').getByRole('button', {name: '继续'}).click();
  await expect(page.getByText('运行已取消')).toBeVisible();
  await expect(page.locator('.run-summary .badge')).toHaveText('已取消');
  await expect(page.getByText('run.cancelled')).toBeVisible();
  await context.close();
});

test('Run 重放和 Checkpoint 恢复刷新通知、状态和事件时间线', async ({browser, request}) => {
  const stamp = Date.now();
  const admin = await login(request);
  const headers = {Authorization: `Bearer ${admin.access_token}`};
  const toolName = `ui-boundary-tool-${stamp}`;
  const tool = await request.post('/api/v1/tools', {headers, data: {name: toolName, executor: 'builtin.echo'}});
  expect([201, 409]).toContain(tool.status());

  async function failedRun(source) {
    const agentResponse = await request.post('/api/v1/agents', {headers, data: {name: `失败 ${source} ${stamp}`, definition: {tool_policies: [{tool: toolName, effect: 'deny'}], workflow: [{key: 'prepare', type: 'prepare'}, {key: 'blocked-tool', type: 'tool', tool_name: toolName, input: {value: source}, depends_on: ['prepare']}]}}});
    expect(agentResponse.status()).toBe(201);
    const agent = (await agentResponse.json()).data;
    expect((await request.post(`/api/v1/agents/${agent.id}/publish`, {headers})).status()).toBe(201);
    const runResponse = await request.post('/api/v1/runs', {headers, data: {agent_id: agent.id, input: {source}}});
    if (runResponse.status() === 429) {
      const existing = await request.get('/api/v1/runs?status=failed&limit=20', {headers});
      expect(existing.status()).toBe(200);
      const candidates = (await existing.json()).data;
      const selected = source === 'restore' ? candidates.find((item) => item.checkpoint_version >= 1) : candidates[0];
      if (!selected) test.skip(true, '租户并发配额已满且没有可复用的失败 Run');
      return selected;
    }
    expect(runResponse.status()).toBe(202);
    const run = (await runResponse.json()).data;
    const executeResponse = await request.post(`/api/v1/runs/${run.id}/execute`, {headers});
    expect(executeResponse.status()).toBe(202);
    await expect.poll(async () => {
      const detail = await request.get(`/api/v1/runs/${run.id}`, {headers});
      return (await detail.json()).data.status;
    }, {timeout: 15000}).toBe('failed');
    return run;
  }

  const replayRun = await failedRun('replay');
  const replayPage = await authenticatedPage(browser, admin);
  await replayPage.page.goto(`${webUrl}/runs/${replayRun.id}`);
  await expect(replayPage.page.getByRole('button', {name: '重放'})).toBeVisible();
  await replayPage.page.getByRole('button', {name: '重放'}).click();
  await replayPage.page.getByRole('dialog').getByRole('button', {name: '继续'}).click();
  await expect(replayPage.page.getByText('已创建重放运行')).toBeVisible();
  await expect(replayPage.page.locator('.run-summary .badge')).toHaveText('已接受');
  await expect(replayPage.page.getByText('run.replayed')).toBeVisible();
  await replayPage.context.close();

  const restoreRun = await failedRun('restore');
  const restorePage = await authenticatedPage(browser, admin);
  await restorePage.page.goto(`${webUrl}/runs/${restoreRun.id}`);
  await expect(restorePage.page.getByRole('button', {name: '恢复'})).toBeVisible();
  await restorePage.page.getByRole('button', {name: '恢复'}).click();
  await restorePage.page.getByRole('dialog').getByRole('button', {name: '继续'}).click();
  await expect(restorePage.page.getByText('已从 Checkpoint 恢复')).toBeVisible();
  await expect(restorePage.page.locator('.run-summary .badge')).toHaveText('已接受');
  await expect(restorePage.page.getByText('run.restored')).toBeVisible();
  await restorePage.context.close();
});
