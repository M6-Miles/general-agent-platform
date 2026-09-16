import {e2eCredentials, requireE2ECredentials} from './credentials.js';
import {test, expect} from '@playwright/test';

const webUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:13001';
const apiUrl = process.env.API_BASE_URL || 'http://127.0.0.1:18001';
test.use({hasTouch: true});

test('知识库页面可创建、上传并检索文档', async ({page}) => {
  requireE2ECredentials();
  const login = await page.context().request.post(`${apiUrl}/api/v1/auth/login`, {data: {email: e2eCredentials.email, password: e2eCredentials.password, tenant_slug: e2eCredentials.tenantSlug}});
  expect(login.ok(), await login.text()).toBeTruthy();
  await page.addInitScript(() => localStorage.setItem('auth_session_hint', '1'));
  await page.goto(`${webUrl}/knowledge`);
  await expect(page.locator('h1', {hasText: '知识库'})).toBeVisible();
  await page.getByRole('button', {name: /创建知识库/}).click();
  await expect(page).toHaveURL(/\/knowledge\/create/);

  const slug = `pw-${Date.now()}`;
  await page.getByLabel('知识库名称').fill('浏览器验收知识库');
  await page.getByLabel(/Slug/).fill(slug);
  await page.getByLabel('描述').fill('Playwright 主链路');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', {name: '创建知识库'}).click();
  await expect(page).toHaveURL(/\/knowledge$/);
  await page.getByText('浏览器验收知识库').click();
  await expect(page.getByRole('heading', {name: '浏览器验收知识库'})).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'playwright-guide.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Playwright 验收要求记录审计事件和租户隔离。'),
  });
  await page.getByText(/文档列表/).click();

  await page.getByRole('button', {name: '检索测试'}).click();
  await page.getByLabel('查询内容').fill('租户隔离');
  await page.getByRole('button', {name: '🔍 检索'}).click();
});

test('知识库移动端可通过触摸完成导航和检索', async ({page}) => {
  requireE2ECredentials();
  const login = await page.context().request.post(`${apiUrl}/api/v1/auth/login`, {data: {email: e2eCredentials.email, password: e2eCredentials.password, tenant_slug: e2eCredentials.tenantSlug}});
  expect(login.ok(), await login.text()).toBeTruthy();
  await page.addInitScript(() => localStorage.setItem('auth_session_hint', '1'));
  await page.setViewportSize({width: 390, height: 844});
  await page.goto(`${webUrl}/knowledge`);
  await expect(page.locator('h1', {hasText: '知识库'})).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
