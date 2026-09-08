// Voice of Customer digest — GET /api/marketing/voice-of-customer.
// VoiceOfCustomerJob itself is cron-triggered, not HTTP, so its Ollama
// clustering logic is covered by direct live-verification (tsx against real
// Ollama+DB, per session convention) — this suite covers the HTTP-facing
// admin surface only. Seeds its own digest row directly via pg (there's no
// POST endpoint by design — digests are system-generated only), matching
// the self-seeding/self-cleaning pattern used elsewhere this session.

import { test, expect } from 'playwright/test';
import { apiUrl } from './support/runtime';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

const TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';
const ADMIN_EMAIL = 'admin_demo@sohamyoga.ca';
const ADMIN_PASSWORD = 'AdminDemo@123456';

// Fixed, distant period so this test's row never collides with a real
// weekly-job-generated digest for the current week.
const PERIOD_START = '2020-01-06';
const PERIOD_END = '2020-01-13';

test.afterAll(async () => {
  await pool.query(
    `DELETE FROM voice_of_customer_digest WHERE tenant_id=$1 AND period_start=$2`,
    [TENANT_ID, PERIOD_START],
  );
  await pool.end();
});

async function seedDigest() {
  await pool.query(
    `INSERT INTO voice_of_customer_digest
       (tenant_id, period_start, period_end, source_message_count, themes, top_complaints, top_requests, overall_summary, report_text)
     VALUES ($1,$2,$3,3,$4,$5,$6,$7,$8)
     ON CONFLICT (tenant_id, period_start, period_end) DO UPDATE SET source_message_count=3`,
    [TENANT_ID, PERIOD_START, PERIOD_END,
      JSON.stringify([{ label: 'e2e-test-theme', count: 2, sentiment: 'negative' }]),
      ['e2e-test-complaint'], ['e2e-test-request'],
      'E2E test digest summary.', 'E2E test digest summary.\n\nThemes: e2e-test-theme (2, negative)'],
  );
}

test.describe('VOC-001 GET voice-of-customer — admin auth', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get(apiUrl('/api/marketing/voice-of-customer'));
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });
});

test.describe('VOC-002 GET voice-of-customer — positive', () => {
  test('an authenticated admin sees a real seeded digest with correct fields', async ({ request }) => {
    await seedDigest();
    const login = await request.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    expect(login.ok()).toBeTruthy();

    const res = await request.get('/api/marketing/voice-of-customer');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const found = body.digests.find((d: { overallSummary: string }) => d.overallSummary === 'E2E test digest summary.');
    expect(found).toMatchObject({
      sourceMessageCount: 3,
      status: 'draft',
      topComplaints: ['e2e-test-complaint'],
      topRequests: ['e2e-test-request'],
    });
    expect(found.themes).toEqual([{ label: 'e2e-test-theme', count: 2, sentiment: 'negative' }]);
  });
});

test.describe('VOC-003 GET voice-of-customer — boundary', () => {
  test('limit query param is respected and capped', async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    expect(login.ok()).toBeTruthy();

    const res = await request.get('/api/marketing/voice-of-customer?limit=1');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.digests.length).toBeLessThanOrEqual(1);
  });
});
