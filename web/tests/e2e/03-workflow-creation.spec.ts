import { test, expect } from '@playwright/test';

/**
 * E2E Test: 工作流创建流程
 * 测试工作流可视化编辑器和节点操作
 */

test.describe('Workflow Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows');
  });

  test('should display workflows page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /工作流|workflow/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /创建|新建|create/i })).toBeVisible();
  });

  test('should navigate to workflow editor', async ({ page }) => {
    await page.getByRole('button', { name: /创建|新建|create/i }).click();

    await expect(page).toHaveURL(/\/workflows\/create/);

    // 等待编辑器加载
    await page.waitForTimeout(1000);
  });

  test('should show name dialog on workflow creation', async ({ page }) => {
    await page.goto('/workflows/create');
    await page.waitForTimeout(1000);

    // 应该显示命名对话框或工作流画布
    const dialog = page.locator('[role="dialog"]');
    const canvas = page.locator('.react-flow');

    const hasDialog = await dialog.isVisible();
    const hasCanvas = await canvas.isVisible();

    expect(hasDialog || hasCanvas).toBeTruthy();
  });

  test('should create workflow with name', async ({ page }) => {
    await page.goto('/workflows/create');
    await page.waitForTimeout(1000);

    // 如果有命名对话框
    const nameInput = page.getByPlaceholder(/工作流名称|workflow name/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill('测试工作流');

      const confirmButton = page.getByRole('button', { name: /确认|确定|ok|confirm/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }

    // 等待画布加载
    await page.waitForTimeout(1000);

    // 验证画布存在
    const canvas = page.locator('.react-flow, [class*="workflow"], [class*="canvas"]');
    await expect(canvas.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display node palette or controls', async ({ page }) => {
    await page.goto('/workflows/create');
    await page.waitForTimeout(2000);

    // 跳过命名对话框
    const nameInput = page.getByPlaceholder(/工作流名称|workflow name/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill('测试');
      await nameInput.press('Enter');
      await page.waitForTimeout(500);
    }

    // 检查是否有节点面板或控制按钮
    const nodePalette = page.locator('[class*="palette"], [class*="panel"], [class*="sidebar"]');
    const hasControls = await nodePalette.count() > 0;

    // 或者检查是否有拖拽元素
    const draggableNodes = page.locator('[draggable="true"]');
    const hasDraggable = await draggableNodes.count() > 0;

    expect(hasControls || hasDraggable).toBeTruthy();
  });

  test('should have save workflow button', async ({ page }) => {
    await page.goto('/workflows/create');
    await page.waitForTimeout(2000);

    // 跳过命名
    const nameInput = page.getByPlaceholder(/工作流名称|workflow name/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill('测试');
      await nameInput.press('Enter');
    }

    await page.waitForTimeout(500);

    // 查找保存按钮
    const saveButton = page.getByRole('button', { name: /保存|save/i });
    await expect(saveButton.first()).toBeVisible({ timeout: 3000 });
  });
});
