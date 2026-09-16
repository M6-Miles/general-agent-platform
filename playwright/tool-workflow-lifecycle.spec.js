import {expect, test} from '@playwright/test';
import {e2eCredentials, requireE2ECredentials} from './credentials.js';

const webUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:13001';
const apiUrl = process.env.API_BASE_URL || 'http://127.0.0.1:18001';

async function expectApi(response, status) {
  expect(response.status(), await response.text()).toBe(status);
  return response.json();
}

async function login(page) {
  requireE2ECredentials();
  await page.goto(`${webUrl}/login`);
  await page.getByLabel('租户标识').fill('demo');
  await page.getByLabel('邮箱').fill(e2eCredentials.email);
  await page.getByLabel('密码').fill(e2eCredentials.password);
  await page.getByRole('button', {name: '登录'}).click();
  await page.waitForURL(/\/$/);
}

test('tool versions remain usable through a real workflow execution', async ({page, request}) => {
  requireE2ECredentials();
  test.setTimeout(90_000);
  const stamp = Date.now();
  const toolName = `工作流回声工具 ${stamp}`;
  const workflowName = `工具执行工作流 ${stamp}`;
  const loginResult = await expectApi(await request.post(`${apiUrl}/api/v1/auth/login`, {
    data: {email: e2eCredentials.email, password: e2eCredentials.password, tenant_slug: e2eCredentials.tenantSlug},
  }), 200);
  const headers = {Authorization: `Bearer ${loginResult.data.access_token}`};

  await login(page);

  await test.step('create, edit, inspect, and roll back an immutable tool version', async () => {
    await page.goto(`${webUrl}/tools/create`);
    await page.getByLabel('工具名称').fill(toolName);
    await page.getByLabel('执行器').fill('builtin.echo');
    await page.getByLabel('描述').fill('版本一：原始配置');
    await page.getByRole('button', {name: '注册工具', exact: true}).click();
    await page.waitForURL(/\/tools\/[^/]+$/);
    await expect(page.getByText('版本 v1')).toBeVisible();

    await page.getByRole('button', {name: '编辑配置'}).click();
    await page.getByLabel('描述').fill('版本二：已更新配置');
    await page.getByRole('button', {name: '保存配置'}).click();
    await expect(page.getByText('版本 v2')).toBeVisible();

    await page.getByRole('button', {name: '版本历史'}).click();
    await expect(page.getByRole('heading', {name: '版本历史'})).toBeVisible();
    await expect(page.locator('.tool-version-row')).toHaveCount(2);
    await page.locator('.tool-version-row').filter({hasText: 'v1'}).getByRole('button', {name: '回滚到此版本'}).click();
    const dialog = page.getByRole('dialog', {name: '回滚到 v1'});
    await expect(dialog).toContainText('创建新的 v3');
    await dialog.getByRole('button', {name: '继续'}).click();
    await expect(page.getByText('已从 v1 恢复，并创建 v3')).toBeVisible();
    await expect(page.locator('.tool-version-row')).toHaveCount(3);
  });

  const toolId = new URL(page.url()).pathname.split('/').at(-1);
  expect(toolId).toBeTruthy();

  await test.step('show a recoverable message for a stale rollback', async () => {
    await expectApi(await request.patch(`${apiUrl}/api/v1/tools/${toolId}`, {
      headers: {...headers, 'If-Match': '3'},
      data: {description: '其他用户保存的版本四'},
    }), 200);
    await page.locator('.tool-version-row').filter({hasText: 'v1'}).getByRole('button', {name: '回滚到此版本'}).click();
    await page.getByRole('dialog', {name: '回滚到 v1'}).getByRole('button', {name: '继续'}).click();
    await expect(page.getByRole('alert').filter({hasText: '工具已被其他用户更新，请刷新版本历史后再试'})).toBeVisible();
  });

  let workflowId;
  await test.step('select the registered tool and persist a connected workflow', async () => {
    await page.goto(`${webUrl}/workflows/create`);
    await page.getByLabel('名称').fill(workflowName);
    await page.getByRole('button', {name: '确认并开始设计', exact: true}).click();
    await page.getByLabel('节点类型:').selectOption('tool');
    await expect(page.getByLabel('已注册工具:')).toContainText(toolName);
    await page.getByLabel('已注册工具:').selectOption(toolId);
    await page.getByRole('button', {name: '添加节点'}).click();
    const toolNode = page.locator('.react-flow__node').filter({hasText: toolName});
    await expect(toolNode).toBeVisible();
    await expect(page.locator('.react-flow__edge-path')).toHaveCount(2);

    await toolNode.click();
    await expect(page.getByRole('heading', {name: '节点属性'})).toBeVisible();
    await page.getByLabel('输入参数 JSON').fill('{"message":"来自节点属性面板"}');
    await page.getByLabel('输入参数 JSON').blur();
    await page.getByLabel('节点类型:').selectOption('model');
    await page.getByRole('button', {name: '添加节点'}).click();
    const modelNode = page.locator('.react-flow__node').filter({hasText: '模型（1）'});
    await modelNode.click();
    await page.getByLabel('模型 Prompt').fill('请总结：{prompt}');
    await page.getByRole('button', {name: '删除节点'}).click();
    await expect(modelNode).toHaveCount(0);
    await page.getByRole('button', {name: '保存工作流'}).click();
    await page.waitForURL((url) => /^\/workflows\/[^/]+$/.test(url.pathname) && url.pathname !== '/workflows/create');
    workflowId = new URL(page.url()).pathname.split('/').at(-1);

    const workflow = await expectApi(await request.get(`${apiUrl}/api/v1/workflows/${workflowId}`, {headers}), 200);
    const persistedToolNode = workflow.data.nodes.find((node) => node.type === 'tool');
    expect(persistedToolNode.config).toMatchObject({tool_id: toolId, tool_name: toolName, input: {message: '来自节点属性面板'}});
    expect(workflow.data.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({source: 'start-1', target: persistedToolNode.id}),
      expect.objectContaining({source: persistedToolNode.id, target: 'end-1'}),
    ]));
  });

  await test.step('execute the workflow and verify the real tool call', async () => {
    await page.getByLabel('运行问题').fill('请原样返回这段测试输入');
    const instanceResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/workflow-instances') && response.request().method() === 'POST');
    await page.getByRole('button', {name: '发布并执行'}).click();
    const instanceResponse = await instanceResponsePromise;
    expect(instanceResponse.status()).toBe(202);
    const instance = (await instanceResponse.json()).data;
    await page.waitForURL(/\/workflow-instances\/[^/]+$/);

    // The isolated Playwright stack intentionally has no long-running worker.
    // Trigger the same durable Worker path synchronously through the API.
    await expectApi(await request.post(`${apiUrl}/api/v1/runs/${instance.run_id}/execute`, {headers}), 202);

    await expect.poll(async () => {
      const response = await request.get(`${apiUrl}/api/v1/runs/${instance.run_id}`, {headers});
      if (!response.ok()) return `HTTP_${response.status()}`;
      return (await response.json()).data.status;
    }, {timeout: 20_000}).toBe('completed');

    const calls = await expectApi(await request.get(`${apiUrl}/api/v1/tools/${toolId}/calls`, {headers}), 200);
    expect(calls.data).toEqual(expect.arrayContaining([
      expect.objectContaining({run_id: instance.run_id, status: 'succeeded'}),
    ]));
    await page.getByRole('button', {name: '刷新'}).click();
    await expect(page.getByText('completed', {exact: true})).toBeVisible();
  });

  await test.step('keep version actions reachable on a narrow touch viewport', async () => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`${webUrl}/tools/${toolId}`);
    await page.getByRole('button', {name: '版本历史'}).click();
    await expect(page.locator('.tool-version-row').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await expect(page.locator('.tool-version-row').filter({hasText: 'v1'}).getByRole('button', {name: '回滚到此版本'})).toBeVisible();
  });
});
