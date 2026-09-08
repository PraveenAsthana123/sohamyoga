// Customer Registration — REG-001..003. Closes a real, previously-flagged
// gap: /customer/register's submit() was a literal "TODO: POST
// /api/auth/register" stub (fake setTimeout, redirected to the
// nonexistent /student/dashboard), and even the real backend register
// endpoint (proxied via next.config.js's fallback rewrite) only ever
// created an ASP.NET Identity account — never a Postgres `customer` row,
// so a self-registered customer had no usable account anywhere else in
// this app (e.g. /customer/referral would 404). This also closes the
// referral click -> registered attribution loop built earlier: /r/[code]
// already tracked clicks for real, but nothing ever turned a click into a
// real referral_master row until now.

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

function id(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`;
}

async function fillStep1(page: import('playwright/test').Page, name: string, email: string, password: string) {
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('8+ characters').fill(password);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Send Email Verification Code' }).click();
  await page.getByPlaceholder('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Continue →' }).click();
}

async function fillStep2(page: import('playwright/test').Page) {
  await page.getByRole('button', { name: /Stress Relief/ }).click();
  await page.getByRole('button', { name: 'beginner' }).click();
  await page.getByRole('button', { name: 'Continue →' }).click();
}

async function fillStep3(page: import('playwright/test').Page) {
  await page.getByRole('button', { name: /Free Trial/ }).click();
  await page.getByRole('button', { name: 'Continue →' }).click();
}

async function fillStep4(page: import('playwright/test').Page) {
  await page.getByText('I accept the Terms of Service').click();
  await page.getByText('I accept the Privacy Policy').click();
  await page.getByRole('button', { name: 'Continue →' }).click();
}

test.describe('REG-001 real end-to-end registration creates a usable account', () => {
  const email = id('reg-e2e');

  test.afterAll(async () => {
    await pool.query(`DELETE FROM customer WHERE email = $1`, [email]);
  });

  test('submitting the wizard creates a real customer row and redirects to a route that exists', async ({ page }) => {
    await page.goto('/customer/register');
    await fillStep1(page, 'Real Registrant', email, 'RealPassword123!');
    await fillStep2(page);
    await fillStep3(page);
    await fillStep4(page);
    await page.getByRole('button', { name: 'Create Account 🎉' }).click();

    // First hit in the run to /api/customer/complete-registration cold-
    // compiles in dev mode on top of the real .NET + Postgres round trip,
    // then /customer/dashboard itself cold-compiles too — generous budget.
    await expect(page).toHaveURL(/\/customer\/dashboard/, { timeout: 60000 });

    const row = await pool.query(`SELECT display_name, email, user_id FROM customer WHERE email = $1`, [email]);
    expect(row.rowCount).toBe(1);
    expect(row.rows[0].display_name).toBe('Real Registrant');
    expect(row.rows[0].user_id).toBeTruthy();
  });
});

test.describe('REG-002 real referral attribution via ?ref= from a shared link', () => {
  let codeId: string; let referrerCustomerId: string; let referrerStudentId: string; let referrerUserId: string;
  const referreeEmail = id('reg-referree');
  const referrerEmail = id('reg-referrer');

  test.beforeAll(async ({ playwright }) => {
    const adminCtx = await playwright.request.newContext();
    await adminCtx.post(apiUrl('/api/auth/login'), { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    const studentRes = await adminCtx.post(apiUrl('/api/admin/students'), {
      data: { displayName: 'Referrer', email: referrerEmail, password: 'StudentDemo@123456', experienceLevel: 'beginner' },
    });
    const studentBody = await studentRes.json();
    referrerStudentId = studentBody.student.id;
    referrerUserId = studentBody.student.user_id;
    await adminCtx.dispose();

    referrerCustomerId = randomUUID();
    codeId = randomUUID();
    await pool.query(
      `INSERT INTO customer (id, tenant_id, user_id, student_id, display_name, email) VALUES ($1,$2,$3,$4,'Referrer',$5)`,
      [referrerCustomerId, TENANT_ID, referrerUserId, referrerStudentId, referrerEmail],
    );
    await pool.query(
      `INSERT INTO referral_code (id, code, referrer_id, referrer_type, referral_url, status)
       VALUES ($1, 'REGTEST-CODE', $2, 'customer_customer', 'https://sohamyoga.ca/r/REGTEST-CODE', 'active')`,
      [codeId, referrerCustomerId],
    );
  });

  test.afterAll(async () => {
    await pool.query(`DELETE FROM referral_registration WHERE referral_id IN (SELECT id FROM referral_master WHERE referral_code_id = $1)`, [codeId]);
    await pool.query(`DELETE FROM referral_master WHERE referral_code_id = $1`, [codeId]);
    await pool.query(`DELETE FROM referral_code WHERE id = $1`, [codeId]);
    await pool.query(`DELETE FROM customer WHERE id = $1 OR email = $2`, [referrerCustomerId, referreeEmail]);
  });

  test('a click-through registration link real-attributes the referral and increments the real code use count', async ({ page }) => {
    await page.goto('/customer/register?ref=REGTEST-CODE');
    // Confirm the ?ref= param actually pre-filled the referral field by
    // checking it survives to step 3 where that field lives.
    await fillStep1(page, 'Referree', referreeEmail, 'RealPassword123!');
    await fillStep2(page);
    await expect(page.getByPlaceholder('AARAV2026')).toHaveValue('REGTEST-CODE');
    await fillStep3(page);
    await fillStep4(page);
    await page.getByRole('button', { name: 'Create Account 🎉' }).click();
    await expect(page).toHaveURL(/\/customer\/dashboard/, { timeout: 15000 });

    const referral = await pool.query(
      `SELECT status, referree_email, referrer_id FROM referral_master WHERE referral_code_id = $1`,
      [codeId],
    );
    expect(referral.rowCount).toBe(1);
    expect(referral.rows[0].status).toBe('registered');
    expect(referral.rows[0].referree_email).toBe(referreeEmail);
    expect(referral.rows[0].referrer_id).toBe(referrerCustomerId);

    const code = await pool.query(`SELECT used_count FROM referral_code WHERE id = $1`, [codeId]);
    expect(code.rows[0].used_count).toBe(1);

    const registration = await pool.query(
      `SELECT registration_source FROM referral_registration WHERE referral_id = (SELECT id FROM referral_master WHERE referral_code_id = $1)`,
      [codeId],
    );
    expect(registration.rowCount).toBe(1);
    expect(registration.rows[0].registration_source).toBe('customer_registration_form');
  });
});

test.describe('REG-003 completing registration twice is idempotent, not a duplicate customer', () => {
  test('calling complete-registration a second time for the same session returns the existing row', async ({ request }) => {
    const email = id('reg-idempotent');
    const login = await request.post('/api/customer/auth/register', { data: { name: 'Idempotent Test', email, password: 'RealPassword123!' } });
    expect(login.ok()).toBeTruthy();

    const first = await request.post('/api/customer/complete-registration', { data: { displayName: 'Idempotent Test' } });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.alreadyExisted).toBe(false);

    const second = await request.post('/api/customer/complete-registration', { data: { displayName: 'Idempotent Test' } });
    const secondBody = await second.json();
    expect(secondBody.alreadyExisted).toBe(true);
    expect(secondBody.customerId).toBe(firstBody.customerId);

    const rows = await pool.query(`SELECT COUNT(*) AS n FROM customer WHERE email = $1`, [email]);
    expect(Number(rows.rows[0].n)).toBe(1);

    await pool.query(`DELETE FROM customer WHERE email = $1`, [email]);
  });
});
