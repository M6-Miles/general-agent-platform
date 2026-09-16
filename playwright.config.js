const apiUrl = process.env.API_BASE_URL || 'http://127.0.0.1:18001';
const webUrl = process.env.WEB_BASE_URL || 'http://127.0.0.1:13001';
const isReuse = process.env.PLAYWRIGHT_MODE === 'reuse';
const apiTarget = new URL(apiUrl);
const webTarget = new URL(webUrl);
export default {
  use: {baseURL: apiUrl},
  workers: Number(process.env.PW_WORKERS || 1),
  testDir: 'playwright',
  webServer: isReuse ? undefined : [
    {
      command: `python scripts/seed.py && python -m uvicorn app.main:app --host ${apiTarget.hostname} --port ${apiTarget.port || '8000'}`,
      url: `${apiUrl}/health`,
      env: {...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL || `sqlite:///./data/playwright-${process.pid}.db`, ALLOWED_ORIGINS: webUrl},
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npm run dev --prefix web -- --hostname ${webTarget.hostname} --port ${webTarget.port || '3000'}`,
      url: webUrl,
      env: {...process.env, NEXT_PUBLIC_API_URL: apiUrl, NEXT_DIST_DIR: `.next-e2e-${webTarget.port || '3000'}`},
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
};
