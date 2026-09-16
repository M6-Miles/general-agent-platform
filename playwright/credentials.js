import {test} from '@playwright/test';

/** Credentials for the disposable local/CI E2E tenant. Never commit values. */
export const e2eCredentials = {
  email: process.env.E2E_ADMIN_EMAIL || '',
  password: process.env.E2E_ADMIN_PASSWORD || '',
  tenantSlug: process.env.E2E_TENANT_SLUG || 'demo',
};

export function requireE2ECredentials() {
  test.skip(!e2eCredentials.email || !e2eCredentials.password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated Playwright tests');
}
