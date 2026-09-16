import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 * 使用隔离端口避免与开发服务器冲突
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:18001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev -- --port 18001',
    url: 'http://localhost:18001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
