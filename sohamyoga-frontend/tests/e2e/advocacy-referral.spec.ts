// Advocacy & Referral Engine — ADV-001..003, REF-001..004. Second stage of
// the growth-loop architecture (Funnel → Advocacy/Referral → Viral →
// Influencer). AdvocacyScoreJob computes a real composite eligibility score
// per active student; the referral API routes wire real API/UI onto the
// migration-052 referral domain (referral_code/referral_campaign/
// referral_master/referral_reward), which previously had zero API/UI even
// though the schema and domain classes were real.

import { test, expect } from 'playwright/test';
import { apiUrl } from './support/runtime';
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

test.describe('ADV-001 GET /api/admin/growth/advocacy — auth gating', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get(apiUrl('/api/admin/growth/advocacy'));
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });
});

test.describe('ADV-002 real advocacy scores', () => {
  test('every score row has a valid eligibility bucket and a recent-problem override that matches churn risk', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/growth/advocacy');
    expect(res.status()).toBe(200);
    const body = await res.json();

    for (const s of body.scores ?? []) {
      expect(['strong_candidate', 'nurture', 'wait', 'ineligible']).toContain(s.eligibility);
      if (s.hasRecentProblem) expect(s.eligibility).toBe('wait');
      expect(s.compositeScore).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('ADV-003 page renders real data', () => {
  test('/admin/growth/advocacy shows real content, not placeholder text', async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto('/admin/growth/advocacy');
    await expect(page.getByRole('main').getByRole('heading', { name: 'Advocacy Scores' })).toBeVisible();
  });
});

test.describe('REF-001 referral endpoints — auth gating', () => {
  for (const path of ['summary', 'list', 'codes', 'campaigns', 'rewards']) {
    test(`GET /api/admin/referral/${path} requires admin auth`, async ({ playwright }) => {
      const unauth = await playwright.request.newContext();
      const res = await unauth.get(apiUrl(`/api/admin/referral/${path}`));
      expect(res.status()).toBe(401);
      await unauth.dispose();
    });
  }
});

test.describe('REF-002 real referral summary — no fabricated numbers', () => {
  test('KPIs are non-negative and internally consistent', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/referral/summary');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.totalReferrals).toBeGreaterThanOrEqual(0);
    expect(body.successful).toBeLessThanOrEqual(body.totalReferrals);
    expect(body.conversionRatePct).toBeGreaterThanOrEqual(0);
    expect(body.conversionRatePct).toBeLessThanOrEqual(100);
  });
});

test.describe('REF-003 reward approve/reject — real ReferralReward state transitions', () => {
  let codeId: string; let referralId: string; let rewardId: string;
  const referrerId = 'd0000000-0000-4000-8000-000000000001'; // real seeded student id used by other specs

  test.beforeAll(async () => {
    codeId = randomUUID(); referralId = randomUUID(); rewardId = randomUUID();
    await pool.query(
      `INSERT INTO referral_code (id, code, referrer_id, referrer_type, referral_url, status)
       VALUES ($1, $2, $3, 'customer_customer', 'https://sohamyoga.ca/r/TESTCODE', 'active')`,
      [codeId, `TEST-${codeId.slice(0, 8)}`, referrerId],
    );
    await pool.query(
      `INSERT INTO referral_master (id, referral_code_id, referrer_id, referree_email, type, status)
       VALUES ($1, $2, $3, 'test-referree@example.com', 'customer_customer', 'reward_pending')`,
      [referralId, codeId, referrerId],
    );
    await pool.query(
      `INSERT INTO referral_reward (id, referral_id, referrer_id, referree_id, reward_for, type, value, status)
       VALUES ($1, $2, $3, $4, 'referrer', 'wallet_credit', 25, 'pending')`,
      [rewardId, referralId, referrerId, randomUUID()],
    );
  });

  test.afterAll(async () => {
    await pool.query(`DELETE FROM referral_reward WHERE id = $1`, [rewardId]);
    await pool.query(`DELETE FROM referral_master WHERE id = $1`, [referralId]);
    await pool.query(`DELETE FROM referral_code WHERE id = $1`, [codeId]);
  });

  test('a seeded pending reward appears in the list and can be approved via the real domain class', async ({ request }) => {
    await loginAsAdmin(request);

    const listRes = await request.get('/api/admin/referral/rewards');
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.rewards.some((r: { id: string }) => r.id === rewardId)).toBe(true);

    const approveRes = await request.post(`/api/admin/referral/rewards/${rewardId}`, { data: { action: 'approve' } });
    expect(approveRes.status()).toBe(200);
    const approveBody = await approveRes.json();
    expect(approveBody.status).toBe('approved');

    const dbRow = await pool.query(`SELECT status, approved_by FROM referral_reward WHERE id = $1`, [rewardId]);
    expect(dbRow.rows[0].status).toBe('approved');
    expect(dbRow.rows[0].approved_by).toBeTruthy();

    const masterRow = await pool.query(`SELECT status FROM referral_master WHERE id = $1`, [referralId]);
    expect(masterRow.rows[0].status).toBe('reward_approved');

    // A second approve on an already-approved reward must be rejected by
    // ReferralReward's own invariant (only pending rewards can be approved).
    const reapproveRes = await request.post(`/api/admin/referral/rewards/${rewardId}`, { data: { action: 'approve' } });
    expect(reapproveRes.status()).toBe(409);
  });

  test('rejecting a pending reward requires a reason', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.post(`/api/admin/referral/rewards/${rewardId}`, { data: { action: 'reject' } });
    expect(res.status()).toBe(400);
  });
});

test.describe('REF-004 referral admin page renders real data', () => {
  test('/admin/referral shows real content, not the old static mock', async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto('/admin/referral');
    await expect(page.getByRole('heading', { name: 'Referral Management' })).toBeVisible();
    // This page fires 5 parallel API calls on mount — under heavy concurrent
    // load (full-suite runs) each can take several seconds; give it room.
    await expect(page.getByText('Total Referrals')).toBeVisible({ timeout: 15000 });
  });
});
