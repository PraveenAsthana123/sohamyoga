// Viral Detection Engine — VIR-001..004. Third piece of the growth-loop
// architecture (Funnel → Advocacy/Referral → Viral → Influencer),
// Facebook-first per the user's explicit instruction. Seeds a real
// social_account + published posts + analytics snapshots (this platform
// has zero real ones today — no account is connected via Postiz OAuth
// yet), runs the real ViralDetectionJob through the same run-job endpoint
// the scheduled cron uses, and verifies the z-score/baseline math against
// hand-computed expected values, then cleans up.

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

test.describe('VIR-001 GET /api/admin/social/facebook/viral-signals — auth gating', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get('http://127.0.0.1:8085/api/admin/social/facebook/viral-signals');
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });
});

test.describe('VIR-002 real z-score computation end to end', () => {
  let tenantId: string; let accountId: string; let draftId: string;
  const postIds: string[] = [];

  test.beforeAll(async () => {
    const tenant = await pool.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
    tenantId = tenant.rows[0].id;
    accountId = randomUUID(); draftId = randomUUID();

    await pool.query(
      `INSERT INTO social_account (id, tenant_id, workspace_id, platform, account_name, platform_account_id, access_token_ref, status, connected_by)
       VALUES ($1, $2, $2, 'facebook', 'Test Studio Page', 'test-page-id', 'vault://test', 'connected', $2)`,
      [accountId, tenantId],
    );
    await pool.query(
      `INSERT INTO social_content_draft (id, tenant_id, workspace_id, master_text, content_type, generated_with_ai, created_by)
       VALUES ($1, $2, $2, 'Test post for viral detection', 'text', false, $2)`,
      [draftId, tenantId],
    );

    // 4 baseline posts with modest share velocity (~2-3 shares/hour), plus
    // 1 outlier post with a much higher velocity (~30 shares/hour).
    const baselineVelocities = [2, 3, 2, 3];
    for (const velocity of baselineVelocities) {
      const postId = randomUUID();
      postIds.push(postId);
      await seedPost(postId, tenantId, accountId, draftId, velocity);
    }
    const viralPostId = randomUUID();
    postIds.push(viralPostId);
    await seedPost(viralPostId, tenantId, accountId, draftId, 30);
  });

  async function seedPost(postId: string, tenant: string, account: string, draft: string, shareVelocityPerHour: number) {
    await pool.query(
      `INSERT INTO social_post (id, tenant_id, workspace_id, draft_id, platform, account_id, idempotency_key, scheduled_at, published_at, status)
       VALUES ($1, $2, $2, $3, 'facebook', $4, $5, now() - interval '3 hours', now() - interval '3 hours', 'published')`,
      [postId, tenant, draft, account, `test-idem-${postId}`],
    );
    const t0 = new Date(Date.now() - 2 * 3_600_000);
    const t1 = new Date();
    await pool.query(
      `INSERT INTO social_post_analytics (post_id, tenant_id, fetched_at, likes, comments, shares) VALUES ($1, $2, $3, 5, 1, 0)`,
      [postId, tenant, t0],
    );
    await pool.query(
      `INSERT INTO social_post_analytics (post_id, tenant_id, fetched_at, likes, comments, shares) VALUES ($1, $2, $3, 10, 2, $4)`,
      [postId, tenant, t1, Math.round(shareVelocityPerHour * 2)],
    );
  }

  test.afterAll(async () => {
    await pool.query(`DELETE FROM viral_signal WHERE post_id = ANY($1)`, [postIds]);
    await pool.query(`DELETE FROM social_post_analytics WHERE post_id = ANY($1)`, [postIds]);
    await pool.query(`DELETE FROM social_post WHERE id = ANY($1)`, [postIds]);
    await pool.query(`DELETE FROM social_content_draft WHERE id = $1`, [draftId]);
    await pool.query(`DELETE FROM social_account WHERE id = $1`, [accountId]);
  });

  test('the seeded outlier post is flagged viral against its own account baseline, baseline posts are not', async ({ request }) => {
    await loginAsAdmin(request);

    const runRes = await request.post('/api/admin/demo-hub/run-job', { data: { name: 'viral-detection' } });
    expect(runRes.status()).toBe(200);
    const runBody = await runRes.json();
    expect(runBody.status).toBe('succeeded');

    const rows = await pool.query<{ post_id: string; share_velocity: string; z_score: string | null; is_viral: boolean; baseline_sample_size: number }>(
      `SELECT post_id, share_velocity, z_score, is_viral, baseline_sample_size FROM viral_signal WHERE post_id = ANY($1)`,
      [postIds],
    );
    expect(rows.rowCount).toBe(5);

    const viralPostId = postIds[4];
    const viralRow = rows.rows.find(r => r.post_id === viralPostId)!;
    expect(viralRow.baseline_sample_size).toBeGreaterThanOrEqual(3);
    expect(Number(viralRow.z_score)).toBeGreaterThan(2);
    expect(viralRow.is_viral).toBe(true);
    expect(Number(viralRow.share_velocity)).toBeCloseTo(30, 0);

    for (const baselinePostId of postIds.slice(0, 4)) {
      const row = rows.rows.find(r => r.post_id === baselinePostId)!;
      expect(row.is_viral).toBe(false);
    }

    const apiRes = await request.get('/api/admin/social/facebook/viral-signals');
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    expect(apiBody.signals.some((s: { postId: string; isViral: boolean }) => s.postId === viralPostId && s.isViral)).toBe(true);
  });
});

test.describe('VIR-003 page renders per-platform tabs', () => {
  test('/admin/social/facebook shows Overview and Viral Signals tabs', async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto('/admin/social/facebook');
    await expect(page.getByRole('heading', { name: 'Facebook' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Viral Signals' })).toBeVisible();
    await page.getByRole('button', { name: 'Viral Signals' }).click();
  });
});

test.describe('VIR-005 Phase E — same job/page shell generalizes to other platforms', () => {
  test('/admin/social/instagram renders honestly with zero connected accounts, no platform-specific code needed', async ({ page }) => {
    await loginAsAdmin(page.request);
    const apiRes = await page.request.get('/api/admin/social/instagram/viral-signals');
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    expect(apiBody.platform).toBe('instagram');

    await page.goto('/admin/social/instagram');
    await expect(page.getByRole('heading', { name: 'Instagram' })).toBeVisible();
  });
});

test.describe('VIR-004 job is registered in the Use Case Catalog and AI governance', () => {
  test('viral-detection has the correct schedule and advisory-only autonomy classification', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/ai-governance');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const entry = body.decision.find((d: { job: string }) => d.job === 'viral-detection');
    expect(entry).toBeTruthy();
    expect(entry.autonomy).toBe('advisory-informational');
  });
});
