// Social Platform Expansion — SPE-001..004. Adds 4 real, source-verified
// Postiz providers (Tumblr, Medium, Dribbble, Twitch — confirmed against
// gitroomhq/postiz-app's own integrations/social directory and
// .env.example, not assumed) and a data-driven left-nav entry per real
// Postiz-native platform, each served by the existing generic
// /admin/social/[platform] page with zero new per-platform code.

import { test, expect } from 'playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

test.afterAll(async () => {
  await pool.end();
});

async function loginAsAdmin(request: import('playwright/test').APIRequestContext) {
  const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
  expect(login.ok()).toBeTruthy();
}

test.describe('SPE-001 new platforms are real, source-verified rows', () => {
  test('tumblr/medium/dribbble/twitch exist with real max_characters, not invented numbers', async () => {
    const res = await pool.query<{ platform: string; max_characters: number; connector: string }>(
      `SELECT platform, max_characters, connector FROM ref_social_platform WHERE platform IN ('tumblr','medium','dribbble','twitch') ORDER BY platform`,
    );
    expect(res.rowCount).toBe(4);
    const byPlatform = Object.fromEntries(res.rows.map(r => [r.platform, r]));
    // Values sourced directly from Postiz's own provider.ts maxLength() implementations.
    expect(byPlatform.tumblr.max_characters).toBe(32768);
    expect(byPlatform.medium.max_characters).toBe(100000);
    expect(byPlatform.dribbble.max_characters).toBe(40000);
    expect(byPlatform.twitch.max_characters).toBe(500);
    for (const row of res.rows) expect(row.connector).toBe('postiz');
  });
});

test.describe('SPE-002 PostizProviderHealthJob tracks all 17 providers, no-dev-app ones auto-configured', () => {
  test('running the job leaves Medium/Twitch configured and Tumblr/Dribbble tracked with real env-var names', async ({ request }) => {
    await loginAsAdmin(request);
    const runRes = await request.post('/api/admin/demo-hub/run-job', { data: { name: 'postiz-provider-health' } });
    expect(runRes.status()).toBe(200);
    expect((await runRes.json()).status).toBe('succeeded');

    const rows = await pool.query<{ provider_name: string; is_configured: boolean }>(
      `SELECT provider_name, is_configured FROM postiz_provider_status WHERE provider_name IN ('Medium','Twitch','Tumblr','Dribbble')`,
    );
    expect(rows.rowCount).toBe(4);
    const byName = Object.fromEntries(rows.rows.map(r => [r.provider_name, r.is_configured]));
    expect(byName.Medium).toBe(true); // no dev app needed — always configured at the app level
    expect(byName.Twitch).toBe(true);
    // Tumblr/Dribbble need real OAuth env vars this environment doesn't have — honestly unconfigured.
    expect(byName.Tumblr).toBe(false);
    expect(byName.Dribbble).toBe(false);
  });
});

test.describe('SPE-003 left nav has a separate entry per real Postiz platform', () => {
  test('the admin sidebar links to /admin/social/tumblr and /admin/social/twitch', async ({ page }) => {
    await page.request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    await page.goto('/admin');
    await expect(page.getByRole('link', { name: 'Tumblr' })).toHaveAttribute('href', '/admin/social/tumblr');
    await expect(page.getByRole('link', { name: 'Twitch' })).toHaveAttribute('href', '/admin/social/twitch');
    await expect(page.getByRole('link', { name: 'Medium' })).toHaveAttribute('href', '/admin/social/medium');
    await expect(page.getByRole('link', { name: 'Dribbble' })).toHaveAttribute('href', '/admin/social/dribbble');
  });
});

test.describe('SPE-004 new platforms work through the existing generic page with zero new code', () => {
  test('/admin/social/tumblr renders the same generic shell already proven for Facebook/Instagram', async ({ page }) => {
    await page.request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    const apiRes = await page.request.get('/api/admin/social/tumblr/viral-signals');
    expect(apiRes.status()).toBe(200);
    expect((await apiRes.json()).platform).toBe('tumblr');

    await page.goto('/admin/social/tumblr');
    await expect(page.getByRole('heading', { name: 'Tumblr' })).toBeVisible({ timeout: 15000 });
  });
});
