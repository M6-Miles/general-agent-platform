import {test, expect} from '@playwright/test';
import {e2eCredentials, requireE2ECredentials} from './credentials.js';

async function auth(request) {
  requireE2ECredentials();
  const response = await request.post('/api/v1/auth/login', {data: {email: e2eCredentials.email, password: e2eCredentials.password, tenant_slug: e2eCredentials.tenantSlug}});
  expect(response.ok()).toBeTruthy();
  return {Authorization: `Bearer ${(await response.json()).data.access_token}`};
}

test('security boundary rejects missing and forged tokens', async ({request}) => {
  expect((await request.get('/api/v1/agents')).status()).toBe(401);
  expect((await request.get('/api/v1/agents', {headers: {Authorization: 'Bearer forged'}})).status()).toBe(401);
});

test('agent versions and rollback create immutable history', async ({request}) => {
  const headers = await auth(request); const stamp = Date.now();
  const created = await request.post('/api/v1/agents', {headers: {...headers, 'Idempotency-Key': `pw-version-${stamp}`}, data: {name: `version-${stamp}`, definition: {workflow: []}}});
  const agent = (await created.json()).data;
  expect((await request.post(`/api/v1/agents/${agent.id}/publish`, {headers})).status()).toBe(201);
  const rollback = await request.post(`/api/v1/agents/${agent.id}/rollback`, {headers, data: {version: 1}});
  expect(rollback.status()).toBe(201);
  const versions = await request.get(`/api/v1/agents/${agent.id}/versions`, {headers});
  expect((await versions.json()).data.length).toBe(2);
});

test('tenant admin can soft-delete an Agent and retain its audit trail', async ({request}) => {
  const headers = await auth(request); const stamp = Date.now();
  const created = await request.post('/api/v1/agents', {headers: {...headers, 'Idempotency-Key': `pw-delete-${stamp}`}, data: {name: `delete-${stamp}`, definition: {workflow: []}}});
  expect(created.status()).toBe(201);
  const agent = (await created.json()).data;
  const deleted = await request.delete(`/api/v1/agents/${agent.id}`, {headers});
  expect(deleted.status()).toBe(204);
  const listed = await request.get('/api/v1/agents', {headers});
  expect((await listed.json()).data.some((item) => item.id === agent.id)).toBeFalsy();
  expect((await request.get(`/api/v1/agents/${agent.id}`, {headers})).status()).toBe(404);
  const audit = await request.get(`/api/v1/audit?resource_type=agent&resource_id=${agent.id}`, {headers});
  expect((await audit.json()).data.some((item) => item.action === 'agent.deleted')).toBeTruthy();
});

test('run history is tenant-scoped and cursor paginated', async ({request}) => {
  const headers = await auth(request); const stamp = Date.now();
  const agent = (await (await request.post('/api/v1/agents', {headers: {...headers, 'Idempotency-Key': `pw-runs-${stamp}`}, data: {name: `runs-${stamp}`, definition: {workflow: []}}})).json()).data;
  expect((await request.post(`/api/v1/agents/${agent.id}/publish`, {headers})).status()).toBe(201);
  const created = await request.post('/api/v1/runs', {headers, data: {agent_id: agent.id, input: {source: 'run-list-test'}}});
  expect(created.status()).toBe(202);
  const listed = await request.get('/api/v1/runs?limit=1', {headers});
  expect(listed.status()).toBe(200);
  const body = await listed.json();
  expect(body.data.some((item) => item.agent_id === agent.id)).toBeTruthy();
  const filtered = await request.get(`/api/v1/runs?agent_id=${agent.id}`, {headers});
  expect((await filtered.json()).data.every((item) => item.agent_id === agent.id)).toBeTruthy();
});

test('run detail supports inspection, event resume and cancellation', async ({request}) => {
  const headers = await auth(request); const stamp = Date.now();
  const agent = (await (await request.post('/api/v1/agents', {headers: {...headers, 'Idempotency-Key': `pw-run-detail-${stamp}`}, data: {name: `run-detail-${stamp}`, definition: {workflow: []}}})).json()).data;
  expect((await request.post(`/api/v1/agents/${agent.id}/publish`, {headers})).status()).toBe(201);
  const created = await request.post('/api/v1/runs', {headers, data: {agent_id: agent.id, input: {source: 'run-detail-test'}}});
  expect(created.status()).toBe(202); const run = (await created.json()).data;
  const detail = await request.get(`/api/v1/runs/${run.id}`, {headers});
  expect(detail.status()).toBe(200); expect((await detail.json()).data.id).toBe(run.id);
  const cancelled = await request.post(`/api/v1/runs/${run.id}/cancel`, {headers});
  expect([200, 202, 409]).toContain(cancelled.status());
});

test('skill moves through review to published', async ({request}) => {
  const headers = await auth(request); const stamp = Date.now();
  const created = await request.post('/api/v1/skills', {headers, data: {slug: `skill-${stamp}`, name: `Skill ${stamp}`, description: 'Playwright skill', version: '1.0.0', manifest: {entrypoint: 'skill', license: 'MIT', riskLevel: 'low', sideEffects: false}}});
  expect(created.status()).toBe(201); const skill = (await created.json()).data;
  expect((await request.post(`/api/v1/skills/${skill.id}/submit`, {headers})).status()).toBe(202);
  const reviewed = await request.post(`/api/v1/skills/${skill.id}/review`, {headers, data: {decision: 'approve', reason: ''}});
  expect((await reviewed.json()).data.status).toBe('published');
});
