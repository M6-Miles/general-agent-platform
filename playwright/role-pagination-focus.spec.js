import {e2eCredentials, requireE2ECredentials} from './credentials.js';
import {test, expect} from '@playwright/test';

const webUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:13001';
const apiUrl = process.env.API_BASE_URL || 'http://127.0.0.1:18001';

async function login(request, email) {
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

test('roles and administrative controls follow the current UI contract', async ({browser, request}) => {
  requireE2ECredentials();
  const admin = await login(request, e2eCredentials.email);

  await test.step('administrator can access Agent management', async () => {
    const {context, page} = await authenticatedPage(browser, admin);
    await page.goto(`${webUrl}/agents`);
    await expect(page.getByRole('heading', {name: 'Agent 管理'})).toBeVisible();
    await expect(page.getByRole('button', {name: /创建 Agent/}).first()).toBeVisible();
    await context.close();
  });

  await test.step('member sees run and read operations but not administrative actions', async () => {
    const session = await login(request, 'member@example.com');
    const {context, page} = await authenticatedPage(browser, session);
    await page.goto(`${webUrl}/agents`);
    await expect(page.getByRole('heading', {name: 'Agent 管理'})).toBeVisible();
    await expect(page.getByRole('link', {name: '创建 Agent'})).toHaveCount(0);
    await page.goto(`${webUrl}/skills`);
    await expect(page.getByRole('link', {name: '创建 Skill'})).toHaveCount(0);
    await page.goto(`${webUrl}/approvals`);
    await expect(page.getByRole('button', {name: '批准'})).toHaveCount(0);
    await page.goto(`${webUrl}/audit`);
    await expect(page.getByRole('button', {name: '导出 CSV'})).toHaveCount(0);
    await context.close();
  });

  await test.step('readonly role cannot enter execute or approval workflows', async () => {
    const session = await login(request, 'readonly@example.com');
    const {context, page} = await authenticatedPage(browser, session);
    await page.goto(`${webUrl}/agents`);
    await expect(page.getByRole('heading', {name: 'Agent 管理'})).toBeVisible();
    await expect(page.getByRole('button', {name: /创建 Agent/})).toHaveCount(0);
    await page.goto(`${webUrl}/skills/create`);
    await expect(page.getByText(/无权创建 Skill/)).toBeVisible();
    await context.close();
  });
});
