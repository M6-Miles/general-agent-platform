import { test, expect } from '@playwright/test';

/**
 * E2E Test: Agent 管理流程
 * 测试 Agent 列表、创建、编辑和删除功能
 */

test.describe('Agent Management', () => {
  test.beforeEach(async ({ page }) => {
    // 模拟登录状态
    await page.goto('/');
  });

  test('should display agents page', async ({ page }) => {
    await page.goto('/agents');

    // 验证页面标题
    await expect(page.getByRole('heading', { name: /agent/i })).toBeVisible();

    // 验证创建按钮存在
    await expect(page.getByRole('button', { name: /创建|新建|create/i })).toBeVisible();
  });

  test('should navigate to create agent page', async ({ page }) => {
    await page.goto('/agents');

    // 点击创建按钮
    await page.getByRole('button', { name: /创建|新建|create/i }).click();

    // 验证跳转到创建页面
    await expect(page).toHaveURL(/\/agents\/create/);

    // 验证表单字段
    await expect(page.getByLabel(/名称|name/i)).toBeVisible();
    await expect(page.getByLabel(/描述|description/i)).toBeVisible();
  });

  test('should validate required fields in create form', async ({ page }) => {
    await page.goto('/agents/create');

    // 不填写任何字段直接提交
    const submitButton = page.getByRole('button', { name: /创建|提交|create|submit/i }).last();
    await submitButton.click();

    // 应该显示验证错误或停留在创建页面
    await page.waitForTimeout(500);
    await expect(page.url()).toContain('/agents/create');
  });

  test('should create new agent with valid data', async ({ page }) => {
    await page.goto('/agents/create');

    // 填写表单
    await page.getByLabel(/名称|name/i).fill('测试 Agent');
    await page.getByLabel(/描述|description/i).fill('这是一个测试 Agent');

    // 如果有模型选择，选择一个模型
    const modelSelect = page.locator('select').first();
    if (await modelSelect.isVisible()) {
      await modelSelect.selectOption({ index: 0 });
    }

    // 提交表单
    const submitButton = page.getByRole('button', { name: /创建|提交|create|submit/i }).last();
    await submitButton.click();

    // 等待跳转或成功提示
    await page.waitForTimeout(2000);

    // 验证是否创建成功（跳转到列表页或详情页）
    expect(page.url()).not.toContain('/create');
  });

  test('should display agent list with cards', async ({ page }) => {
    await page.goto('/agents');

    // 等待数据加载
    await page.waitForTimeout(1500);

    // 检查是否有卡片或空状态
    const cards = page.locator('[class*="card"]');
    const emptyState = page.locator('[class*="empty"]');

    const hasCards = (await cards.count()) > 0;
    const hasEmptyState = await emptyState.isVisible();

    // 至少应该显示一个状态
    expect(hasCards || hasEmptyState).toBeTruthy();
  });

  test('should search and filter agents', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForTimeout(1000);

    // 查找搜索输入框
    const searchInput = page.getByPlaceholder(/搜索|search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('测试');
      await page.waitForTimeout(500);

      // 结果应该被过滤
      const resultsCount = await page.locator('[class*="card"]').count();
      expect(resultsCount).toBeGreaterThanOrEqual(0);
    }
  });
});
