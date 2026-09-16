import { test, expect } from '@playwright/test';
import { e2eCredentials, requireE2ECredentials } from './credentials.js';

test('authenticated runtime happy path', async ({ request }) => {
  requireE2ECredentials();
  const login = await request.post('/api/v1/auth/login', {
    data: { email: e2eCredentials.email, password: e2eCredentials.password, tenant_slug: e2eCredentials.tenantSlug },
  });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).data.access_token;
  const headers = { Authorization: `Bearer ${token}` };
  const name = `playwright-agent-${Date.now()}`;
  const agentResponse = await request.post('/api/v1/agents', {
    headers: { ...headers, 'Idempotency-Key': `pw-${Date.now()}-agent` },
    data: { name, definition: { workflow: [] } },
  });
  expect([201, 409]).toContain(agentResponse.status());
  const agent = (await agentResponse.json()).data;
  expect(agent.id).toBeTruthy();
  expect((await request.post(`/api/v1/agents/${agent.id}/publish`, {headers})).status()).toBe(201);
  const run = await request.post('/api/v1/runs', {
    headers,
    data: { agent_id: agent.id, input: { prompt: 'playwright smoke test' } },
  });
  expect(run.status()).toBe(202);
  expect((await run.json()).data.id).toBeTruthy();
  const agents = await request.get('/api/v1/agents', { headers });
  expect(agents.ok()).toBeTruthy();
});
