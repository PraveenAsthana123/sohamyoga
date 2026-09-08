// Campaign health findings — GET /api/ads/health-findings + PATCH .../[id].
// CampaignHealthAuditJob is cron-triggered, not HTTP, so it's covered by
// direct live-verification (tsx against real Ollama+DB) rather than here;
// this suite covers the HTTP-facing surface: listing, filtering, and the
// acknowledge/resolve review workflow an admin actually uses.
//
// Findings have no POST endpoint by design (system-generated only), so this
// suite seeds its own campaign + finding rows directly via `pg`, matching
// tests/e2e/consent-automation.spec.ts's self-seeding/self-cleaning pattern.
// Fixture ids carry a fixed prefix swept in afterAll.

import { test, expect } from 'playwright/test';
import { apiUrl } from './support/runtime';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

const CAMPAIGN_ID = 'e2eeeeee-1111-4000-8000-000000000001';

// These routes are requireAdmin-gated. Seeded dev admin credentials — from
// SohamYoga.Web/appsettings.Development.json, local dev/test only, already
// checked into the repo. Every test logs in fresh via its own `request`
// fixture (Playwright persists the session cookie across calls made through
// the same fixture instance, like a browser context) — except the explicit
// no-auth negative test, which opens its own separate, never-logged-in context.
const ADMIN_EMAIL = 'admin_demo@sohamyoga.ca';
const ADMIN_PASSWORD = 'AdminDemo@123456';

test.beforeEach(async ({ request }) => {
  const res = await request.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  expect(res.ok(), 'admin login must succeed for these tests to be meaningful').toBeTruthy();
});

test.beforeAll(async () => {
  await pool.query(
    `INSERT INTO ad_campaign (id, name, campaign_type, status, daily_budget_cents, start_date, created_by)
     VALUES ($1, 'E2E Health Findings Campaign', 'search', 'active', 5000, CURRENT_DATE, 'e2e-test-harness')
     ON CONFLICT (id) DO NOTHING`,
    [CAMPAIGN_ID],
  );
});

test.afterAll(async () => {
  await pool.query(`DELETE FROM ad_campaign_health_finding WHERE campaign_id = $1`, [CAMPAIGN_ID]);
  await pool.query(`DELETE FROM ad_campaign WHERE id = $1`, [CAMPAIGN_ID]);
  await pool.end();
});

async function seedFinding(findingKey: string, severity: 'info' | 'warning' | 'critical' = 'warning') {
  const row = await pool.query<{ id: string }>(
    `INSERT INTO ad_campaign_health_finding (campaign_id, finding_key, severity, summary, recommended_action, facts)
     VALUES ($1,$2,$3,'Test finding summary.','Test recommended action.','{}')
     RETURNING id`,
    [CAMPAIGN_ID, findingKey, severity],
  );
  return row.rows[0].id;
}

test.describe('HEALTH-FINDINGS-001 GET — positive', () => {
  test('an open finding is returned with campaign name and severity', async ({ request }) => {
    const id = await seedFinding('e2e_positive_finding');
    const res = await request.get('/api/ads/health-findings?status=open');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const found = body.findings.find((f: { id: string }) => f.id === id);
    expect(found).toMatchObject({
      campaignId: CAMPAIGN_ID, campaignName: 'E2E Health Findings Campaign',
      findingKey: 'e2e_positive_finding', severity: 'warning', status: 'open',
    });
  });
});

test.describe('HEALTH-FINDINGS-002 — negative', () => {
  test('PATCH with an invalid action is rejected with 400', async ({ request }) => {
    const id = await seedFinding('e2e_negative_badaction');
    const res = await request.patch(`/api/ads/health-findings/${id}`, { data: { action: 'delete' } });
    expect(res.status()).toBe(400);
  });

  test('PATCH on an unknown id returns 404', async ({ request }) => {
    const res = await request.patch('/api/ads/health-findings/00000000-0000-4000-8000-000000000000', {
      data: { action: 'resolve' },
    });
    expect(res.status()).toBe(404);
  });

  test('GET without admin auth is rejected (no cookie sent)', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get(apiUrl('/api/ads/health-findings'));
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });
});

test.describe('HEALTH-FINDINGS-003 — boundary', () => {
  test('acknowledging a finding removes it from the open filter but keeps it in all', async ({ request }) => {
    const id = await seedFinding('e2e_boundary_ack');
    const ack = await request.patch(`/api/ads/health-findings/${id}`, { data: { action: 'acknowledge' } });
    expect(ack.status()).toBe(200);
    expect((await ack.json())).toMatchObject({ ok: true, status: 'acknowledged' });

    const openList = await request.get('/api/ads/health-findings?status=open');
    expect((await openList.json()).findings.some((f: { id: string }) => f.id === id)).toBe(false);

    const allList = await request.get('/api/ads/health-findings?status=all');
    const found = (await allList.json()).findings.find((f: { id: string }) => f.id === id);
    expect(found).toMatchObject({ status: 'acknowledged' });
  });

  test('resolving a finding sets resolved_at', async ({ request }) => {
    const id = await seedFinding('e2e_boundary_resolve');
    const res = await request.patch(`/api/ads/health-findings/${id}`, { data: { action: 'resolve' } });
    expect(res.status()).toBe(200);

    const row = await pool.query(`SELECT status, resolved_at FROM ad_campaign_health_finding WHERE id=$1`, [id]);
    expect(row.rows[0].status).toBe('resolved');
    expect(row.rows[0].resolved_at).not.toBeNull();
  });
});

test.describe('HEALTH-FINDINGS-004 — end to end review workflow', () => {
  test('a finding moves open -> acknowledged -> resolved through successive admin actions', async ({ request }) => {
    const id = await seedFinding('e2e_e2e_lifecycle', 'critical');

    let list = await request.get('/api/ads/health-findings?status=open');
    expect((await list.json()).findings.some((f: { id: string }) => f.id === id)).toBe(true);

    const ack = await request.patch(`/api/ads/health-findings/${id}`, { data: { action: 'acknowledge' } });
    expect((await ack.json()).status).toBe('acknowledged');

    const resolve = await request.patch(`/api/ads/health-findings/${id}`, { data: { action: 'resolve' } });
    expect((await resolve.json()).status).toBe('resolved');

    list = await request.get('/api/ads/health-findings?status=open');
    expect((await list.json()).findings.some((f: { id: string }) => f.id === id)).toBe(false);
  });
});
