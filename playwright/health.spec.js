import {test, expect} from '@playwright/test';
test('health endpoint', async ({request}) => { const response = await request.get('/health'); expect(response.ok()).toBeTruthy(); expect((await response.json()).status).toBe('ok'); });
