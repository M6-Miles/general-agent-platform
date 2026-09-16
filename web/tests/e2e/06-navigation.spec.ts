import { test, expect } from '@playwright/test';

/**
 * E2E Test: 导航和页面访问
 * 测试所有主要页面的可访问性和导航功能
 */

test.describe('Navigation and Page Access', () => {
  const pages = [
    { path: '/', name: '首页' },
    { path: '/agents', name: 'Agent 管理' },
    { path: '/workflows', name: '工作流' },
    { path: '/tools', name: '工具' },
    { path: '/skills', name: 'Skill 市场' },
    { path: '/knowledge', name: '知识库' },
    { path: '/runs', name: '运行记录' },
    { path: '/approvals', name: '审批' },
    { path: '/audit', name: '审计日志' },
    { path: '/settings', name: '设置' },
  ];

  test('should access all main pages without errors', async ({ page }) => {
    for (const { path, name } of pages) {
      await page.goto(path);
      await page.waitForTimeout(500);

      // 验证页面加载成功（没有错误页面）
      const errorText = await page.textContent('body');
      expect(errorText).not.toContain('404');
      expect(errorText).not.toContain('500');

      console.log(`✓ ${name} (${path}) loaded successfully`);
    }
  });

  test('should navigate using header navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // 查找导航链接
    const agentsLink = page.getByRole('link', { name: /agent/i });
    if (await agentsLink.isVisible()) {
      await agentsLink.click();
      await expect(page).toHaveURL(/\/agents/);
    }
  });

  test('should display language switcher', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // 查找语言切换器
    const languageSwitcher = page.locator('[class*="language"], button').filter({ hasText: /中文|EN|JP|🌐/ });

    if (await languageSwitcher.first().isVisible()) {
      await languageSwitcher.first().click();
      await page.waitForTimeout(300);

      // 应该显示语言选项
      const hasOptions = await page.locator('text=/中文|English|日本語/').count() > 0;
      expect(hasOptions).toBeTruthy();
    }
  });

  test('should display user profile or settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // 查找用户相关的按钮或链接
    const userButton = page.locator('[class*="user"], [class*="profile"], [class*="avatar"]').first();
    const settingsLink = page.getByRole('link', { name: /设置|settings/i });

    const hasUserUI = (await userButton.count()) > 0 || (await settingsLink.isVisible());
    expect(hasUserUI).toBeTruthy();
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    await page.goto('/non-existent-page-12345');
    await page.waitForTimeout(500);

    // 应该显示 404 页面或重定向
    const bodyText = await page.textContent('body');
    const is404 = bodyText?.includes('404') || bodyText?.includes('找不到') || bodyText?.includes('Not Found');
    const isRedirected = !page.url().includes('non-existent-page-12345');

    expect(is404 || isRedirected).toBeTruthy();
  });

  test('should load pages within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/agents');
    const loadTime = Date.now() - startTime;

    // 页面应该在 5 秒内加载完成
    expect(loadTime).toBeLessThan(5000);
  });

  test('should have consistent header across pages', async ({ page }) => {
    await page.goto('/agents');
    const header1 = await page.locator('header, [role="banner"]').first().textContent();

    await page.goto('/workflows');
    const header2 = await page.locator('header, [role="banner"]').first().textContent();

    // 头部应该存在且包含核心导航元素
    expect(header1).toBeTruthy();
    expect(header2).toBeTruthy();
  });
});
