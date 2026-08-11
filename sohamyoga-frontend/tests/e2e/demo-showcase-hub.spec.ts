// Demo Showcase Hub — DEMO-001..004. Covers the real fixed-credential demo
// accounts (admin_demo/customer_demo, seeded in SohamYoga.Web/Data/SeedData.cs),
// the admin Demo Hub page (use-case catalog, sequence flows, related tooling
// links, on-demand "Run Now" job trigger), and the customer self-service
// features page. The run-job endpoint executes the real job module (not a
// simulation) — DEMO-003 exercises it against leaderboard-refresh, a fast
// non-Ollama job, to keep the test quick and deterministic.

import { test, expect } from 'playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

test.afterAll(async () => {
  await pool.end();
});

test.describe('DEMO-001 admin_demo — Demo Showcase Hub', () => {
  test('renders the credential box, use-case catalog, sequence flows and related tooling', async ({ page, request }) => {
    const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    expect(login.ok()).toBeTruthy();
    const state = await request.storageState();
    await page.context().addCookies(state.cookies);

    await page.goto('/admin/demo-hub');
    await expect(page.getByRole('main').getByRole('heading', { name: 'Demo Showcase Hub' })).toBeVisible();
    await expect(page.getByRole('main').getByText('admin_demo@sohamyoga.ca')).toBeVisible();
    await expect(page.getByRole('main').getByText('customer_demo@sohamyoga.ca')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Now' }).first()).toBeVisible();

    await page.getByRole('button', { name: /Sequence Flows/ }).click();
    await expect(page.getByText('Voice of Customer (weekly digest)')).toBeVisible();

    await page.getByRole('button', { name: /Related Tooling/ }).click();
    await expect(page.getByRole('main').getByRole('link', { name: /Module Assurance/ })).toBeVisible();
  });
});

test.describe('DEMO-002 customer_demo — self-service features page', () => {
  test('renders the real feature groups for the logged-in demo customer', async ({ page, request }) => {
    const login = await request.post('/api/customer/auth/login', { data: { email: 'customer_demo@sohamyoga.ca', password: 'CustomerDemo@123456' } });
    expect(login.ok()).toBeTruthy();
    const state = await request.storageState();
    await page.context().addCookies(state.cookies);

    await page.goto('/customer/features');
    await expect(page.getByRole('heading', { name: 'Everything available to you' })).toBeVisible();
    await expect(page.getByText('Signed in as Demo Customer')).toBeVisible();
    await expect(page.getByRole('link', { name: 'AI Yoga Coach' })).toBeVisible();
  });
});

test.describe('DEMO-003 POST /api/admin/demo-hub/run-job — positive', () => {
  test('running a real job executes it and records a succeeded operation_run row', async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    expect(login.ok()).toBeTruthy();

    const res = await request.post('/api/admin/demo-hub/run-job', { data: { name: 'leaderboard-refresh' } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'succeeded', jobName: 'leaderboard-refresh' });
    expect(typeof body.durationMs).toBe('number');

    const row = await pool.query(
      `SELECT status, actor_id, source FROM operation_run WHERE operation_name='leaderboard-refresh' AND source='demo-hub' ORDER BY created_at DESC LIMIT 1`,
    );
    expect(row.rows[0]).toMatchObject({ status: 'succeeded', actor_id: 'admin_demo@sohamyoga.ca', source: 'demo-hub' });
  });
});

test.describe('DEMO-004 POST /api/admin/demo-hub/run-job — negative', () => {
  test('an unauthenticated request is rejected with 401', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.post('http://127.0.0.1:8085/api/admin/demo-hub/run-job', { data: { name: 'leaderboard-refresh' } });
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });

  test('an unknown job name is rejected with 404', async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    expect(login.ok()).toBeTruthy();

    const res = await request.post('/api/admin/demo-hub/run-job', { data: { name: 'not-a-real-job' } });
    expect(res.status()).toBe(404);
  });

  test('a missing name is rejected with 400', async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    expect(login.ok()).toBeTruthy();

    const res = await request.post('/api/admin/demo-hub/run-job', { data: {} });
    expect(res.status()).toBe(400);
  });
});
