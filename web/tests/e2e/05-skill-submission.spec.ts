import { test, expect } from '@playwright/test';

/**
 * E2E Test: Skill 提交流程
 * 测试 Skill 市场浏览和 Skill 创建功能
 */

test.describe('Skill Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/skills');
  });

  test('should display skills marketplace', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /skill/i })).toBeVisible();
  });

  test('should navigate to skill creation page', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /提交.*skill|submit.*skill/i });
    await expect(submitButton.first()).toBeVisible();

    await submitButton.first().click();
    await expect(page).toHaveURL(/\/skills\/create/);
  });

  test('should display skill creation form', async ({ page }) => {
    await page.goto('/skills/create');

    // 验证核心字段
    await expect(page.getByLabel(/标识|slug|id/i)).toBeVisible();
    await expect(page.getByLabel(/名称|name/i)).toBeVisible();
    await expect(page.getByLabel(/描述|description/i)).toBeVisible();
    await expect(page.getByLabel(/版本|version/i)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/skills/create');

    const submitButton = page.getByRole('button', { name: /创建|提交|create|submit/i }).last();
    await submitButton.click();

    await page.waitForTimeout(500);
    await expect(page.url()).toContain('/skills/create');
  });

  test('should create skill with valid data', async ({ page }) => {
    await page.goto('/skills/create');

    // 填写必填字段
    await page.getByLabel(/标识|slug/i).fill('test-skill');
    await page.getByLabel(/名称|name/i).fill('测试技能');
    await page.getByLabel(/版本|version/i).fill('1.0.0');

    const descField = page.getByLabel(/描述|description/i);
    if (await descField.isVisible()) {
      await descField.fill('这是一个测试技能包');
    }

    const submitButton = page.getByRole('button', { name: /创建|提交|create|submit/i }).last();
    await submitButton.click();

    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/create');
  });

  test('should support manifest import', async ({ page }) => {
    await page.goto('/skills/create');

    // 查找导入按钮或文件输入
    const importButton = page.getByText(/导入.*manifest|import.*manifest/i);
    await expect(importButton).toBeVisible();
  });

  test('should display skills in marketplace', async ({ page }) => {
    await page.waitForTimeout(1000);

    const cards = page.locator('[class*="card"]');
    const emptyState = page.locator('[class*="empty"]');

    const hasContent = (await cards.count()) > 0 || (await emptyState.isVisible());
    expect(hasContent).toBeTruthy();
  });
});
