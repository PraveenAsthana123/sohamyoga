// Market Research — MR-001..008. Framework -> Topic -> 4-tab hierarchy over
// 3 real research frameworks: the 17-layer market research & forecasting
// framework (population -> forecasting), the New Entrant Market Entry
// Scorecard (20 components, §6), and the Existing Centre Growth Research
// framework (52 components, §7). research_framework/research_topic/
// research_topic_tab (migration 085-market-research) are seeded once by
// scripts/migrate-domain-schemas.sh with real, user-supplied framework
// content — these tests assert the seeded data and its admin UI, not
// synthetic fixtures created per-test. Job Schedule is not a 4th
// research_topic_tab row — it's computed server-side from
// research_topic.job_name + CRON_JOBS + operation_run.

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

test.describe('MR-001 the 3 frameworks and 89 seeded topics are real rows, not filler', () => {
  test('research_framework has exactly 3 rows; research_topic has 89 rows (17+20+52), all framework-linked', async () => {
    const frameworks = await pool.query(`SELECT slug FROM research_framework ORDER BY sort_order`);
    expect(frameworks.rowCount).toBe(3);
    expect(frameworks.rows.map(r => r.slug)).toEqual(['17-layer-forecasting', 'new-entrant-scorecard', 'existing-centre-growth']);

    const topics = await pool.query(`SELECT slug, layer_number, framework_id FROM research_topic ORDER BY layer_number`);
    expect(topics.rowCount).toBe(89);
    expect(topics.rows.every(r => r.framework_id !== null)).toBe(true);

    const perFramework = await pool.query(
      `SELECT f.slug, COUNT(*)::int AS n FROM research_topic t JOIN research_framework f ON f.id = t.framework_id GROUP BY f.slug`,
    );
    const counts = Object.fromEntries(perFramework.rows.map(r => [r.slug, r.n]));
    expect(counts['17-layer-forecasting']).toBe(17);
    expect(counts['new-entrant-scorecard']).toBe(20);
    expect(counts['existing-centre-growth']).toBe(52);

    const tabs = await pool.query(`SELECT DISTINCT tab_key FROM research_topic_tab ORDER BY tab_key`);
    expect(tabs.rows.map(r => r.tab_key)).toEqual(['input', 'output', 'process']);

    const tabCount = await pool.query(`SELECT COUNT(*)::int AS n FROM research_topic_tab`);
    expect(tabCount.rows[0].n).toBe(267); // 89 topics x 3 tabs

    const pricingJob = await pool.query(`SELECT job_name FROM research_topic WHERE slug = 'pricing'`);
    expect(pricingJob.rows[0].job_name).toBe('market-research-pricing-digest');

    const otherJobs = await pool.query(`SELECT COUNT(*)::int AS n FROM research_topic WHERE slug != 'pricing' AND job_name IS NOT NULL`);
    expect(otherJobs.rows[0].n).toBe(0);
  });
});

test.describe('MR-002 framework list page shows all 3 frameworks with real topic counts', () => {
  test('/admin/market-research shows 3 framework cards; clicking one shows the right topic count', async ({ page }) => {
    await page.request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    await page.goto('/admin/market-research');

    await expect(page.getByRole('main').getByRole('heading', { name: 'Market Research' })).toBeVisible({ timeout: 15000 });
    const cards = page.locator('a[href^="/admin/market-research/"]');
    await expect(cards).toHaveCount(3);

    await expect(page.getByRole('link', { name: /17-Layer Market Research/ })).toContainText('17 topics');
    await expect(page.getByRole('link', { name: /New Entrant Market Entry Scorecard/ })).toContainText('20 topics');
    await expect(page.getByRole('link', { name: /Existing Centre Growth Research/ })).toContainText('52 topics');

    await page.getByRole('link', { name: /New Entrant Market Entry Scorecard/ }).click();
    await expect(page).toHaveURL(/\/admin\/market-research\/new-entrant-scorecard$/);
    await expect(page.getByRole('heading', { name: 'New Entrant Market Entry Scorecard' })).toBeVisible({ timeout: 15000 });
    const topicLinks = page.locator('a[href^="/admin/market-research/new-entrant-scorecard/"]');
    await expect(topicLinks).toHaveCount(20);
  });
});

test.describe('MR-003 topic detail page has the 4-tab structure in order', () => {
  test('Job Schedule, Input, Process, Output tabs appear in that order with real content', async ({ page }) => {
    await page.request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    await page.goto('/admin/market-research/17-layer-forecasting/population');

    await expect(page.getByRole('heading', { name: 'Population' })).toBeVisible({ timeout: 15000 });

    const tabButtons = page.locator('div.flex.gap-1 button');
    await expect(tabButtons).toHaveCount(4);
    await expect(tabButtons.nth(0)).toHaveText('Job Schedule');
    await expect(tabButtons.nth(1)).toHaveText('Input');
    await expect(tabButtons.nth(2)).toHaveText('Process');
    await expect(tabButtons.nth(3)).toHaveText('Output');

    await page.getByRole('button', { name: 'Process' }).click();
    await expect(page.getByText('Calgary/Alberta population', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Input' }).click();
    await expect(page.getByText('Population, households, age', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Output' }).click();
    await expect(page.getByText('Addressable population', { exact: true })).toBeVisible();
  });
});

test.describe('MR-004 Job Schedule tab reflects real automation state honestly', () => {
  test('the pricing topic (automated) shows a real schedule/status; another topic shows "Not yet automated"', async ({ page }) => {
    await page.request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });

    await page.goto('/admin/market-research/17-layer-forecasting/pricing');
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Job Schedule' })).toHaveClass(/bg-blue-600/); // active by default
    await expect(page.getByText('market-research-pricing-digest')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Now' })).toBeVisible();

    await page.goto('/admin/market-research/new-entrant-scorecard/market-definition');
    await expect(page.getByRole('heading', { name: 'Market Definition' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Not yet automated.')).toBeVisible();
  });
});

test.describe('MR-005 unknown framework/topic slugs 404 honestly', () => {
  test('GET /api/admin/market-research/[unknown-framework] returns 404', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/market-research/not-a-real-framework');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not-a-real-framework');
  });

  test('GET /api/admin/market-research/[framework]/[unknown-topic] returns 404, not a blank 200', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/market-research/17-layer-forecasting/not-a-real-topic');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not-a-real-topic');
  });

  test('a topic that exists but not in that framework 404s rather than leaking cross-framework', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/market-research/new-entrant-scorecard/pricing');
    expect(res.status()).toBe(404);
  });

  test('an unauthenticated request is denied, not served', async ({ request }) => {
    const res = await request.get('/api/admin/market-research');
    expect(res.status()).toBe(401);
  });
});
