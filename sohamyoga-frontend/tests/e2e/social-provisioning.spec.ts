// Social Account Provisioning — admin control plane. Covers the real
// bulk-setup/advance-drafts endpoints (idempotent by design, so re-running
// them here is safe against the live persistent system state rather than
// disposable fixtures) and the per-platform 8-tab page, including the
// negative case that a platform's generated task list must NOT include
// steps its real requirement flags don't call for (e.g. Telegram has no
// OAuth, so it must never show OAUTH_APPROVAL).

import { test, expect } from 'playwright/test';
import { apiUrl } from './support/runtime';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

test.afterAll(async () => {
  await pool.end();
});

async function loginAsAdmin(request: import('playwright/test').APIRequestContext) {
  const res = await request.post(apiUrl('/api/auth/login'), {
    data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' },
  });
  expect(res.ok()).toBeTruthy();
}

async function runJob(request: import('playwright/test').APIRequestContext, name: string) {
  const res = await request.post(apiUrl('/api/admin/demo-hub/run-job'), { data: { name } });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe('PROV-001 Social Account Provisioning — bulk setup and per-platform pages', () => {
  test('unauthenticated requests are rejected', async ({ request }) => {
    const res = await request.get(apiUrl('/api/admin/social/provisioning/platform/telegram'));
    expect(res.status()).toBe(401);
  });

  test('bulk-setup is idempotent against the real system state', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.post(apiUrl('/api/admin/social/provisioning/bulk-setup'), {
      data: { accountName: 'SohamYoga' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // Every registered platform already has a job from prior real setup —
    // this call must create none of them again.
    expect(body.createdCount).toBe(0);
    expect(body.skippedCount).toBeGreaterThan(0);
  });

  test('advance-drafts is idempotent once no DRAFT jobs remain', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.post(apiUrl('/api/admin/social/provisioning/advance-drafts'));
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.advancedCount).toBe(0);
    expect(body.blockedCount).toBe(0);
  });

  test('unknown platform returns 404', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get(apiUrl('/api/admin/social/provisioning/platform/not_a_real_platform'));
    expect(res.status()).toBe(404);
  });

  test('Telegram (OFFICIAL_API, no OAuth) never gets an OAUTH_APPROVAL or BUSINESS_VERIFICATION task', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get(apiUrl('/api/admin/social/provisioning/platform/telegram'));
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const taskTypes = body.tasks.map((t: { task_type: string }) => t.task_type);
    expect(taskTypes).not.toContain('OAUTH_APPROVAL');
    expect(taskTypes).not.toContain('BUSINESS_VERIFICATION');
    expect(taskTypes).toContain('TERMS_ACCEPTANCE');
    expect(body.requirement.developer_creation_mode).toBe('OFFICIAL_API');
  });

  test('Instagram (MANUAL, business page, OAuth) gets OAUTH_APPROVAL and BUSINESS_VERIFICATION tasks', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get(apiUrl('/api/admin/social/provisioning/platform/instagram'));
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const taskTypes = body.tasks.map((t: { task_type: string }) => t.task_type);
    expect(taskTypes).toContain('OAUTH_APPROVAL');
    expect(taskTypes).toContain('BUSINESS_VERIFICATION');
  });

  test('Skyvern cannot be started against a MANUAL-mode platform even if VALIDATION_PASSED', async ({ request }) => {
    await loginAsAdmin(request);
    const detail = await request.get(apiUrl('/api/admin/social/provisioning/platform/instagram'));
    const body = await detail.json();
    expect(body.requirement.developer_creation_mode).toBe('MANUAL');
    const jobId = body.jobs[0].id;
    const res = await request.post(apiUrl(`/api/admin/social/provisioning/${jobId}/skyvern`));
    expect(res.status()).toBe(409);
    const err = await res.json();
    expect(err.error).toContain('classified MANUAL');
  });

  test('overview page renders and links into a per-platform page', async ({ page }) => {
    await page.request.post(apiUrl('/api/auth/login'), {
      data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' },
    });
    await page.goto(apiUrl('/admin/social/provisioning'));
    await expect(page.getByRole('heading', { name: 'Social Account Provisioning' })).toBeVisible();
    await page.getByRole('link', { name: /telegram/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/social\/provisioning\/telegram/);
    await expect(page.getByRole('heading', { name: 'telegram', exact: false })).toBeVisible();
  });

  test('per-platform page exposes all 8 mandatory tabs', async ({ page }) => {
    await page.request.post(apiUrl('/api/auth/login'), {
      data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' },
    });
    await page.goto(apiUrl('/admin/social/provisioning/instagram'));
    for (const tab of ['Dashboard', 'Report', 'Manual Process', 'Automatic Process', 'AI Exp', 'AI Governance', 'AI Risk', 'ResAI']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }
  });
});

test.describe('PROV-002 provisioning-task-staleness job', () => {
  test('assigns a real due date to open tasks and creates/resolves a real overdue alert', async ({ request }) => {
    await loginAsAdmin(request);

    // Fixture: one real open task, backdated to prove the overdue branch —
    // torn down in this same test regardless of pass/fail.
    const { rows } = await pool.query(
      `SELECT id FROM provisioning_human_task WHERE status = 'open' LIMIT 1`,
    );
    expect(rows.length).toBeGreaterThan(0);
    const taskId = rows[0].id;
    const originalDueAt: string | null = (await pool.query(
      `SELECT due_at FROM provisioning_human_task WHERE id = $1`, [taskId],
    )).rows[0].due_at;

    try {
      await pool.query(`UPDATE provisioning_human_task SET due_at = now() - interval '10 days' WHERE id = $1`, [taskId]);

      const first = await runJob(request, 'provisioning-task-staleness');
      expect(first.status).toBe('succeeded');

      const alert = await pool.query(
        `SELECT severity, status FROM provisioning_task_alert WHERE task_id = $1`, [taskId],
      );
      expect(alert.rows[0].severity).toBe('critical');
      expect(alert.rows[0].status).toBe('open');

      // Resolving the task (not deleting it, not faking completion by a
      // human — this simulates the task genuinely being done) must resolve
      // the alert on the next run.
      await pool.query(`UPDATE provisioning_human_task SET status = 'completed', completed_at = now() WHERE id = $1`, [taskId]);
      const second = await runJob(request, 'provisioning-task-staleness');
      expect(second.status).toBe('succeeded');

      const resolved = await pool.query(
        `SELECT status FROM provisioning_task_alert WHERE task_id = $1`, [taskId],
      );
      expect(resolved.rows[0].status).toBe('resolved');
    } finally {
      // Restore exactly the pre-test state: open, original due date, no alert.
      await pool.query(`UPDATE provisioning_human_task SET status = 'open', completed_at = NULL, due_at = $2 WHERE id = $1`, [taskId, originalDueAt]);
      await pool.query(`DELETE FROM provisioning_task_alert WHERE task_id = $1`, [taskId]);
    }
  });

  test('never leaves an open task without a due date', async ({ request }) => {
    await loginAsAdmin(request);
    await runJob(request, 'provisioning-task-staleness');
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM provisioning_human_task WHERE status = 'open' AND due_at IS NULL`,
    );
    expect(rows[0].n).toBe(0);
  });
});

test.describe('PROV-003 brand profile drafting and approval gate', () => {
  test('unauthenticated requests are rejected', async ({ request }) => {
    const res = await request.get(apiUrl('/api/admin/social/brand-profile'));
    expect(res.status()).toBe(401);
  });

  test('drafted profile never contains a banned unverified quality claim', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get(apiUrl('/api/admin/social/brand-profile'));
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.profile).not.toBeNull();
    const haystack = [body.profile.tagline, body.profile.bio_80, body.profile.bio_150, body.profile.bio_255, body.profile.description_1000].join(' ').toLowerCase();
    for (const banned of ['expert', 'experienced instructor', 'award-winning', 'certified instructor']) {
      expect(haystack).not.toContain(banned);
    }
  });

  test('platform-bio-draft refuses to run while the master profile is not approved', async ({ request }) => {
    await loginAsAdmin(request);
    const before = await pool.query(`SELECT approval_status FROM social_brand_profile ORDER BY created_at DESC LIMIT 1`);
    // This test only asserts the honest-skip behavior; it must never itself
    // decide the real approval, so it only proceeds while still in draft.
    test.skip(before.rows[0]?.approval_status !== 'draft', 'profile has already been reviewed by a human — not this test\'s decision to make');

    const countBefore = (await pool.query(`SELECT count(*)::int AS n FROM social_platform_bio`)).rows[0].n;
    await runJob(request, 'platform-bio-draft');
    const countAfter = (await pool.query(`SELECT count(*)::int AS n FROM social_platform_bio`)).rows[0].n;
    expect(countAfter).toBe(countBefore);
  });

  test('reject then restore to draft — proves the PATCH transition works without permanently deciding the real approval', async ({ request }) => {
    await loginAsAdmin(request);
    const original = (await pool.query(`SELECT id, approval_status FROM social_brand_profile ORDER BY created_at DESC LIMIT 1`)).rows[0];
    expect(original).toBeTruthy();

    try {
      const res = await request.patch(apiUrl('/api/admin/social/brand-profile'), { data: { action: 'reject' } });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.profile.approval_status).toBe('rejected');
    } finally {
      // Restore the real pending state exactly — this is a human's decision,
      // not a state this test is allowed to leave changed.
      await pool.query(
        `UPDATE social_brand_profile SET approval_status = $2, approved_by = NULL, approved_at = NULL WHERE id = $1`,
        [original.id, original.approval_status],
      );
    }
  });
});
