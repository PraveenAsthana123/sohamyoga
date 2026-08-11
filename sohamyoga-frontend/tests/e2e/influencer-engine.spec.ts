// Influencer Engine — INF-001..004. Fourth and final piece of the
// growth-loop architecture (Funnel → Advocacy/Referral → Viral →
// Influencer). InfluencerValueJob scores real referral attribution only;
// an influencer with no referral code issued yet must report
// insufficient_data, never a fabricated score.

import { test, expect } from 'playwright/test';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

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

test.describe('INF-001 GET /api/admin/growth/influencers — auth gating', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get('http://127.0.0.1:8085/api/admin/growth/influencers');
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });
});

test.describe('INF-002/003 real value scoring — no code vs real referral attribution', () => {
  let tenantId: string;
  const noCodeInfluencerId = randomUUID();
  const scoredInfluencerId = randomUUID();
  let codeId: string; let referralIds: string[] = [];
  const studentId = 'd0000000-0000-4000-8000-000000000001';

  test.beforeAll(async () => {
    const tenant = await pool.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
    tenantId = tenant.rows[0].id;
    codeId = randomUUID();

    await pool.query(
      `INSERT INTO influencer_profile (id, tenant_id, handle, platform, follower_count, tier, status)
       VALUES ($1, $2, 'no-code-influencer', 'instagram', 5000, 'micro', 'identified')`,
      [noCodeInfluencerId, tenantId],
    );

    await pool.query(
      `INSERT INTO referral_code (id, code, referrer_id, referrer_type, referral_url, status)
       VALUES ($1, $2, $3, 'influencer', 'https://sohamyoga.ca/r/INFTEST', 'active')`,
      [codeId, `INFTEST-${codeId.slice(0, 8)}`, studentId],
    );
    await pool.query(
      `INSERT INTO influencer_profile (id, tenant_id, handle, platform, follower_count, tier, status, referral_code_id)
       VALUES ($1, $2, 'scored-influencer', 'instagram', 20000, 'mid', 'active', $3)`,
      [scoredInfluencerId, tenantId, codeId],
    );

    // 2 successful referrals with real order amounts attributed to this code.
    for (const amount of [150, 250]) {
      const referralId = randomUUID();
      referralIds.push(referralId);
      await pool.query(
        `INSERT INTO referral_master (id, referral_code_id, referrer_id, referree_email, type, status, order_amount)
         VALUES ($1, $2, $3, $4, 'influencer', 'membership_purchased', $5)`,
        [referralId, codeId, studentId, `${referralId}@example.com`, amount],
      );
    }
  });

  test.afterAll(async () => {
    await pool.query(`DELETE FROM influencer_value_score WHERE influencer_id = ANY($1)`, [[noCodeInfluencerId, scoredInfluencerId]]);
    await pool.query(`DELETE FROM referral_master WHERE id = ANY($1)`, [referralIds]);
    await pool.query(`DELETE FROM influencer_profile WHERE id = ANY($1)`, [[noCodeInfluencerId, scoredInfluencerId]]);
    await pool.query(`DELETE FROM referral_code WHERE id = $1`, [codeId]);
  });

  test('an influencer with no referral code is insufficient_data; one with real attribution gets a real score', async ({ request }) => {
    await loginAsAdmin(request);

    const runRes = await request.post('/api/admin/demo-hub/run-job', { data: { name: 'influencer-value' } });
    expect(runRes.status()).toBe(200);
    expect((await runRes.json()).status).toBe('succeeded');

    const rows = await pool.query<{ influencer_id: string; referral_count: number; revenue_attributed: string; value_score: string; value_status: string }>(
      `SELECT influencer_id, referral_count, revenue_attributed, value_score, value_status FROM influencer_value_score WHERE influencer_id = ANY($1)`,
      [[noCodeInfluencerId, scoredInfluencerId]],
    );
    expect(rows.rowCount).toBe(2);

    const noCodeRow = rows.rows.find(r => r.influencer_id === noCodeInfluencerId)!;
    expect(noCodeRow.value_status).toBe('insufficient_data');
    expect(Number(noCodeRow.value_score)).toBe(0);

    const scoredRow = rows.rows.find(r => r.influencer_id === scoredInfluencerId)!;
    expect(scoredRow.value_status).toBe('scored');
    expect(scoredRow.referral_count).toBe(2);
    expect(Number(scoredRow.revenue_attributed)).toBeCloseTo(400, 2);
    // 2 referrals * 5 = 10 referral points; $400 -> floor(400/100)=4 * 5 = 20 revenue points; total 30.
    expect(Number(scoredRow.value_score)).toBe(30);

    const apiRes = await request.get('/api/admin/growth/influencers');
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    const apiScored = apiBody.influencers.find((i: { id: string }) => i.id === scoredInfluencerId);
    expect(apiScored.valueScore).toBe(30);
    expect(apiScored.valueStatus).toBe('scored');
  });
});

test.describe('INF-004 page renders real data', () => {
  test('/admin/growth/influencers shows real content', async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto('/admin/growth/influencers');
    await expect(page.getByRole('heading', { name: 'Influencers' })).toBeVisible();
  });
});
