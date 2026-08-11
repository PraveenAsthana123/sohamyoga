// Contact form → lead capture pipeline. POST/GET /api/contact — previously
// this route didn't exist at all (ContactForm.tsx posted to it, but it
// targeted the now-deleted SLPSystems.Web ContactController.cs), so every
// real visitor contact-form submission silently failed, and the real,
// working, Ollama-based LeadNurturingJob (registered, correctly wired to the
// CRM Leads tab) had zero real leads to ever score.
//
// LeadNurturingJob itself is cron-triggered, not HTTP, so its scoring logic
// is covered by direct live-verification (tsx against real Ollama+DB), not
// here — this suite covers the HTTP-facing surface: the actual submission
// endpoint and the admin's raw-submissions list.

import { test, expect } from 'playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

const ADMIN_EMAIL = 'admin@sohamyoga.ca';
const ADMIN_PASSWORD = 'Admin@123456';
const PREFIX = 'e2e-contact-';
const email = (suffix: string) => `${PREFIX}${suffix}@example.com`;

test.afterAll(async () => {
  await pool.query(`DELETE FROM campaign_lead WHERE email LIKE $1`, [`${PREFIX}%@example.com`]);
  await pool.end();
});

test.describe('CONTACT-001 POST /api/contact — positive', () => {
  test('a valid submission is accepted and creates a real campaign_lead row', async ({ request }) => {
    const leadEmail = email('positive-1');
    const res = await request.post('/api/contact', {
      data: {
        name: 'Test Visitor', email: leadEmail, phone: '403-555-0100', company: 'Acme',
        subject: 'Class inquiry', serviceInterest: 'Class Schedule',
        message: 'Hello, I would like to know more about your beginner class schedule this month.',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const row = await pool.query(
      `SELECT first_name, last_name, email, source_platform, funnel_stage, subject, message, service_interest, company
       FROM campaign_lead WHERE id = $1`,
      [body.id],
    );
    expect(row.rows[0]).toMatchObject({
      first_name: 'Test', last_name: 'Visitor', email: leadEmail,
      source_platform: 'website_form', funnel_stage: 'new',
      subject: 'Class inquiry', service_interest: 'Class Schedule', company: 'Acme',
    });
  });
});

test.describe('CONTACT-002 POST /api/contact — negative', () => {
  test('missing name is rejected with 400 and nothing is written', async ({ request }) => {
    const leadEmail = email('negative-noname');
    const res = await request.post('/api/contact', {
      data: { email: leadEmail, subject: 'x', message: '1234567890' },
    });
    expect(res.status()).toBe(400);
    const count = await pool.query(`SELECT COUNT(*) FROM campaign_lead WHERE email = $1`, [leadEmail]);
    expect(Number(count.rows[0].count)).toBe(0);
  });

  test('an invalid email is rejected with 400', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: { name: 'A', email: 'not-an-email', subject: 'x', message: '1234567890' },
    });
    expect(res.status()).toBe(400);
  });

  test('missing subject is rejected with 400', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: { name: 'A', email: email('negative-nosubject'), message: '1234567890' },
    });
    expect(res.status()).toBe(400);
  });

  test('a message over 5000 characters is rejected with 400', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: { name: 'A', email: email('negative-toolong'), subject: 'x', message: 'x'.repeat(5001) },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('CONTACT-003 POST /api/contact — boundary', () => {
  test('a message of exactly 10 characters (the minimum) is accepted', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: { name: 'A', email: email('boundary-min10'), subject: 'x', message: '1234567890' },
    });
    expect(res.status()).toBe(201);
  });

  test('a message of 9 characters (below the minimum) is rejected with 400', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: { name: 'A', email: email('boundary-below10'), subject: 'x', message: '123456789' },
    });
    expect(res.status()).toBe(400);
  });

  test('optional fields (phone/company/serviceInterest) may be omitted', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: { name: 'Minimal Visitor', email: email('boundary-minimal'), subject: 'x', message: '1234567890' },
    });
    expect(res.status()).toBe(201);
  });
});

test.describe('CONTACT-004 GET /api/contact — admin', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get('http://127.0.0.1:8085/api/contact');
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });

  test('an authenticated admin sees a fresh submission in the raw list', async ({ request }) => {
    const leadEmail = email('e2e-admin-visible');
    const submit = await request.post('/api/contact', {
      data: { name: 'Admin Visible', email: leadEmail, subject: 'x', message: '1234567890' },
    });
    expect(submit.status()).toBe(201);

    const login = await request.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    expect(login.ok()).toBeTruthy();

    const res = await request.get('/api/contact');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.submissions.some((s: { email: string }) => s.email === leadEmail)).toBe(true);
  });
});

test.describe('CONTACT-005 end to end — this is the real fix for a previously-broken flow', () => {
  test('a submission through the exact same shape ContactForm.tsx sends succeeds end to end', async ({ request }) => {
    const leadEmail = email('e2e-full-flow');
    // Mirrors ContactForm.tsx's handleSubmit payload exactly.
    const res = await request.post('/api/contact', {
      data: {
        name: 'Full Flow Visitor', email: leadEmail, phone: '403-555-0199', company: undefined,
        subject: 'Membership question', serviceInterest: 'Membership & Pricing',
        message: 'What membership options do you have for someone who wants to practice twice a week?',
      },
    });
    expect(res.status()).toBe(201);
    const { id } = await res.json();

    // Confirm it's real, queryable, and has the shape LeadNurturingJob expects to score.
    const row = await pool.query(
      `SELECT funnel_stage, lead_score, created_at FROM campaign_lead WHERE id = $1`,
      [id],
    );
    expect(row.rows[0].funnel_stage).toBe('new');
    expect(row.rows[0].lead_score).toBeNull(); // not yet scored — LeadNurturingJob hasn't run
    expect(row.rows[0].created_at).toBeTruthy();
  });
});
