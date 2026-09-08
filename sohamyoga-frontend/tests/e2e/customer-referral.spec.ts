// Customer Self-Service Referral — CREF-001..005. Closes the previously
// explicit "no public customer-facing referral/share UI" boundary.
// ReferralInvitationJob issues a real referral code (via the real
// ReferralCode domain class) to strong_candidate customers and drafts a
// fact-checked invitation; the customer sees it on /customer/referral,
// and /r/[code] really tracks a click before redirecting to registration.

import { test, expect } from 'playwright/test';
import { apiUrl } from './support/runtime';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });
const TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';

test.afterAll(async () => {
  await pool.end();
});

async function loginAsAdmin(request: import('playwright/test').APIRequestContext) {
  const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
  expect(login.ok()).toBeTruthy();
}

function id(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`;
}

test.describe('CREF-001 GET /api/customer/referral — auth gating', () => {
  test('requires customer auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get(apiUrl('/api/customer/referral'));
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });
});

test.describe('CREF-002 end to end — advocacy eligibility to a real issued code and click tracking', () => {
  let studentId: string; let userId: string; let customerId: string; let code: string;
  const email = id('cref-student');

  test.beforeAll(async ({ playwright }) => {
    // Real student + real ASP.NET Identity account via the same endpoint
    // TSO-002 uses, so this customer can genuinely log in afterward.
    const adminCtx = await playwright.request.newContext();
    const adminLogin = await adminCtx.post(apiUrl('/api/auth/login'), { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    expect(adminLogin.ok()).toBeTruthy();

    const studentRes = await adminCtx.post(apiUrl('/api/admin/students'), {
      data: { displayName: 'CREF Student', email, password: 'StudentDemo@123456', experienceLevel: 'beginner' },
    });
    expect(studentRes.status()).toBe(201);
    const studentBody = await studentRes.json();
    studentId = studentBody.student.id;
    userId = studentBody.student.user_id;
    await adminCtx.dispose();

    customerId = randomUUID();
    await pool.query(
      `INSERT INTO customer (id, tenant_id, user_id, student_id, display_name, email)
       VALUES ($1, $2, $3, $4, 'CREF Student', $5)`,
      [customerId, TENANT_ID, userId, studentId, email],
    );
    await pool.query(
      `INSERT INTO advocacy_score (tenant_id, student_id, composite_score, eligibility)
       VALUES ($1, $2, 70, 'strong_candidate')`,
      [TENANT_ID, studentId],
    );
  });

  test.afterAll(async () => {
    await pool.query(`DELETE FROM referral_click WHERE referral_code_id IN (SELECT id FROM referral_code WHERE referrer_id = $1)`, [customerId]);
    await pool.query(`DELETE FROM referral_code WHERE referrer_id = $1`, [customerId]);
    await pool.query(`DELETE FROM advocacy_score WHERE student_id = $1`, [studentId]);
    await pool.query(`DELETE FROM customer WHERE id = $1`, [customerId]);
  });

  test('the job issues a real code with a fact-checked draft, the customer sees it, and clicking the link is tracked for real', async ({ request }) => {
    await loginAsAdmin(request);
    const runRes = await request.post('/api/admin/demo-hub/run-job', { data: { name: 'referral-invitation' } });
    expect(runRes.status()).toBe(200);
    expect((await runRes.json()).status).toBe('succeeded');

    const codeRow = await pool.query<{ code: string; referrer_id: string; invitation_draft: string | null }>(
      `SELECT code, referrer_id, invitation_draft FROM referral_code WHERE referrer_id = $1 AND status = 'active'`,
      [customerId],
    );
    expect(codeRow.rowCount).toBe(1);
    code = codeRow.rows[0].code;
    // No active campaign exists in this environment, so the fact-check
    // must have discarded any Ollama-invented reward figure — the draft
    // (real or fallback template) must contain no dollar/percent figure.
    expect(codeRow.rows[0].invitation_draft).toBeTruthy();
    expect(codeRow.rows[0].invitation_draft).not.toMatch(/[$€£]\s?\d|\d+%/);

    // Log in as the real customer and see their real code via the API.
    const custLogin = await request.post('/api/customer/auth/login', { data: { email, password: 'StudentDemo@123456' } });
    expect(custLogin.ok()).toBeTruthy();

    const apiRes = await request.get('/api/customer/referral');
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    expect(apiBody.hasCode).toBe(true);
    expect(apiBody.code.code).toBe(code);
    expect(apiBody.activeCampaign).toBeNull();

    // Clicking the real shared link records a real click and redirects.
    const clickRes = await request.get(`/r/${code}`, { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(clickRes.status());
    expect(clickRes.headers()['location']).toContain('/customer/register');

    const clickRow = await pool.query<{ click_count: number }>(`SELECT click_count FROM referral_code WHERE code = $1`, [code]);
    expect(clickRow.rows[0].click_count).toBe(1);
    const clickLog = await pool.query(`SELECT id FROM referral_click WHERE referral_code_id = (SELECT id FROM referral_code WHERE code = $1)`, [code]);
    expect(clickLog.rowCount).toBe(1);
  });
});

test.describe('CREF-003 self-service generate-code is idempotent', () => {
  let studentId: string; let userId: string; let customerId: string;
  const email = id('cref-selfservice');

  test.beforeAll(async ({ playwright }) => {
    const adminCtx = await playwright.request.newContext();
    await adminCtx.post(apiUrl('/api/auth/login'), { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    const studentRes = await adminCtx.post(apiUrl('/api/admin/students'), {
      data: { displayName: 'CREF SelfService', email, password: 'StudentDemo@123456', experienceLevel: 'beginner' },
    });
    const studentBody = await studentRes.json();
    studentId = studentBody.student.id;
    userId = studentBody.student.user_id;
    await adminCtx.dispose();

    customerId = randomUUID();
    await pool.query(
      `INSERT INTO customer (id, tenant_id, user_id, student_id, display_name, email)
       VALUES ($1, $2, $3, $4, 'CREF SelfService', $5)`,
      [customerId, TENANT_ID, userId, studentId, email],
    );
  });

  test.afterAll(async () => {
    await pool.query(`DELETE FROM referral_code WHERE referrer_id = $1`, [customerId]);
    await pool.query(`DELETE FROM customer WHERE id = $1`, [customerId]);
  });

  test('generating a code twice returns the same code, not a duplicate', async ({ request }) => {
    const login = await request.post('/api/customer/auth/login', { data: { email, password: 'StudentDemo@123456' } });
    expect(login.ok()).toBeTruthy();

    const first = await request.post('/api/customer/referral/generate-code');
    expect(first.status()).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.alreadyExisted).toBe(false);

    const second = await request.post('/api/customer/referral/generate-code');
    const secondBody = await second.json();
    expect(secondBody.alreadyExisted).toBe(true);
    expect(secondBody.code).toBe(firstBody.code);

    const rows = await pool.query(`SELECT COUNT(*) AS n FROM referral_code WHERE referrer_id = $1`, [customerId]);
    expect(Number(rows.rows[0].n)).toBe(1);
  });
});

test.describe('CREF-005 self-service page renders real data', () => {
  let studentId: string; let userId: string; let customerId: string;
  const email = id('cref-page');

  test.beforeAll(async ({ playwright }) => {
    const adminCtx = await playwright.request.newContext();
    await adminCtx.post(apiUrl('/api/auth/login'), { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    const studentRes = await adminCtx.post(apiUrl('/api/admin/students'), {
      data: { displayName: 'CREF Page', email, password: 'StudentDemo@123456', experienceLevel: 'beginner' },
    });
    const studentBody = await studentRes.json();
    studentId = studentBody.student.id;
    userId = studentBody.student.user_id;
    await adminCtx.dispose();

    customerId = randomUUID();
    await pool.query(
      `INSERT INTO customer (id, tenant_id, user_id, student_id, display_name, email)
       VALUES ($1, $2, $3, $4, 'CREF Page', $5)`,
      [customerId, TENANT_ID, userId, studentId, email],
    );
  });

  test.afterAll(async () => {
    await pool.query(`DELETE FROM referral_code WHERE referrer_id = $1`, [customerId]);
    await pool.query(`DELETE FROM customer WHERE id = $1`, [customerId]);
  });

  test('/customer/referral shows the "get a link" prompt with no code, then the real link after generating one', async ({ page }) => {
    const login = await page.request.post('/api/customer/auth/login', { data: { email, password: 'StudentDemo@123456' } });
    expect(login.ok()).toBeTruthy();

    await page.goto('/customer/referral');
    // First hit to this route + its API route both cold-compile in dev
    // mode — same generous timeout used elsewhere for a live first render.
    await expect(page.getByRole('heading', { name: 'Refer a Friend' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Get My Referral Link' })).toBeVisible();

    await page.getByRole('button', { name: 'Get My Referral Link' }).click();
    await expect(page.getByText('Your referral link')).toBeVisible();
    await expect(page.getByRole('link', { name: 'WhatsApp' })).toBeVisible();
  });
});

test.describe('CREF-004 job is registered in AI governance', () => {
  test('referral-invitation is draft-requires-approval, not fully autonomous', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/ai-governance');
    const body = await res.json();
    const entry = body.decision.find((d: { job: string }) => d.job === 'referral-invitation');
    expect(entry).toBeTruthy();
    expect(entry.autonomy).toBe('draft-requires-approval');
  });
});
