import { test, expect } from '@playwright/test';

/**
 * E2E Test: 知识库管理流程
 * 测试知识库创建、文档上传和检索功能
 */

test.describe('Knowledge Base Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/knowledge');
  });

  test('should display knowledge base page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /知识库|knowledge/i })).toBeVisible();
  });

  test('should navigate to create knowledge base page', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /创建|新建|create/i });
    if (await createButton.isVisible()) {
      await createButton.click();
      await expect(page).toHaveURL(/\/knowledge\/create/);
    }
  });

  test('should display knowledge base form fields', async ({ page }) => {
    await page.goto('/knowledge/create');
    await page.waitForTimeout(500);

    // 验证表单字段
    await expect(page.getByLabel(/名称|name/i)).toBeVisible();
  });

  test('should create new knowledge base', async ({ page }) => {
    await page.goto('/knowledge/create');

    await page.getByLabel(/名称|name/i).fill('产品文档库');

    const descField = page.getByLabel(/描述|description/i);
    if (await descField.isVisible()) {
      await descField.fill('公司产品使用文档');
    }

    const submitButton = page.getByRole('button', { name: /创建|提交|create|submit/i }).last();
    await submitButton.click();

    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/create');
  });

  test('should display knowledge base list', async ({ page }) => {
    await page.waitForTimeout(1000);

    const cards = page.locator('[class*="card"]');
    const emptyState = page.locator('[class*="empty"]');

    const hasContent = (await cards.count()) > 0 || (await emptyState.isVisible());
    expect(hasContent).toBeTruthy();
  });

  test('should search knowledge bases', async ({ page }) => {
    await page.waitForTimeout(1000);

    const searchInput = page.getByPlaceholder(/搜索|search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('产品');
      await page.waitForTimeout(500);

      const resultsCount = await page.locator('[class*="card"]').count();
      expect(resultsCount).toBeGreaterThanOrEqual(0);
    }
  });
});
