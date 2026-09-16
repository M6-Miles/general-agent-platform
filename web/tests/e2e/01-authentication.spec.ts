import { test, expect } from '@playwright/test';

/**
 * E2E Test: 用户认证流程
 * 测试用户登录、令牌获取和退出功能
 */

test.describe('Authentication Flow', () => {
  const e2eEmail = process.env.E2E_ADMIN_EMAIL;
  const e2ePassword = process.env.E2E_ADMIN_PASSWORD;

  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /登录|login/i })).toBeVisible();
    await expect(page.getByLabel('邮箱')).toBeVisible();
    await expect(page.getByLabel('密码')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /登录|login/i }).click();

    // 应该显示验证错误或保持在登录页
    await expect(page.url()).toContain('/login');
  });

  test('should handle invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('邮箱').fill('invalid@example.com');
    await page.getByLabel('密码').fill('wrong_password');
    await page.getByRole('button', { name: /登录|login/i }).click();

    // 等待错误消息或停留在登录页
    await page.waitForTimeout(1000);
    await expect(page.url()).toContain('/login');
  });

  test('should redirect to home after successful login', async ({ page }) => {
    test.skip(!e2eEmail || !e2ePassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated checks');
    await page.goto('/login');

    // 使用测试账号
    await page.getByLabel('邮箱').fill(e2eEmail!);
    await page.getByLabel('密码').fill(e2ePassword!);
    await page.getByRole('button', { name: /登录|login/i }).click();

    // 等待导航
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 5000 });

    // 验证已登录状态
    expect(page.url()).not.toContain('/login');
  });

  test('should restore login state from the HttpOnly refresh cookie', async ({ page }) => {
    test.skip(!e2eEmail || !e2ePassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated checks');
    await page.goto('/login');
    await page.getByLabel('邮箱').fill(e2eEmail!);
    await page.getByLabel('密码').fill(e2ePassword!);
    await page.getByRole('button', {name: /登录|login/i}).click();
    await page.waitForURL(/\/$/);
    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
  });
});
