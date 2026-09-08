// Guided Simulation — SIM-001..003. Complements the Demo Hub's static
// Sequence Flows tab with a live-run walkthrough: each step either
// inspects real data or triggers the real job (POST /api/admin/demo-hub/
// run-job — the same code path a schedule uses). campaign-health-audit is
// used for the full-cycle test since it's deterministic SQL (no Ollama
// wait), backed by the same seeded "Demo Showcase Campaign (no ad groups)"
// fixture the Reports tab tests already depend on.

import { test, expect } from 'playwright/test';
import { apiUrl } from './support/runtime';

async function loginAsAdmin(request: import('playwright/test').APIRequestContext) {
  const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
  expect(login.ok()).toBeTruthy();
}

test.describe('SIM-001 GET /api/admin/demo-hub/simulation-step', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get(apiUrl('/api/admin/demo-hub/simulation-step?flow=churn-prediction&step=source-data'));
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });

  test('an unknown flow/step pair is rejected with 404', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/demo-hub/simulation-step?flow=not-a-flow&step=source-data');
    expect(res.status()).toBe(404);
  });

  test('a real, known step returns real rows', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/demo-hub/simulation-step?flow=campaign-health-audit&step=source-data');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.rows)).toBe(true);
  });
});

test.describe('SIM-002 full guided walkthrough — campaign-health-audit', () => {
  test('inspect source → run real job → inspect real result, end to end in the browser', async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto('/admin/simulation');
    await expect(page.getByRole('main').getByRole('heading', { name: 'Guided Simulation' })).toBeVisible();

    await page.getByRole('button', { name: 'Campaign Health Audit' }).click();

    const inspectSourceBtn = page.getByRole('button', { name: /Inspect: Active ad campaigns/ });
    await inspectSourceBtn.click();
    await expect(page.getByText('Demo Showcase Campaign')).toBeVisible();

    const runBtn = page.getByRole('button', { name: /Run real job: campaign-health-audit/ });
    await expect(runBtn).toBeEnabled();
    await runBtn.click();
    await expect(page.getByText(/✓ succeeded/)).toBeVisible({ timeout: 15000 });

    const inspectResultBtn = page.getByRole('button', { name: /Inspect: Findings produced/ });
    await expect(inspectResultBtn).toBeEnabled();
    await inspectResultBtn.click();
    await expect(page.getByText('no_ad_groups')).toBeVisible();
  });
});

test.describe('SIM-003 flow switcher', () => {
  test('switching flows resets the walkthrough to step 1', async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto('/admin/simulation');

    await page.getByRole('button', { name: 'Voice of Customer' }).click();
    await expect(page.getByRole('button', { name: /Run real job: voice-of-customer/ })).toBeDisabled();

    await page.getByRole('button', { name: 'Churn Prediction' }).click();
    await expect(page.getByRole('button', { name: /Run real job: churn-prediction/ })).toBeDisabled();
  });
});
