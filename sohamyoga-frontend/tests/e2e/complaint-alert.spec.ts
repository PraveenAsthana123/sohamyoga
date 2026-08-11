// ComplaintAlertJob — CA-001..004. Resumes a task interrupted earlier this
// session by a pivot to customer-click tracking, then a much larger
// mega-request. Real-time complement to the weekly Voice of Customer
// digest: a negative comment/review/message shouldn't wait a week to
// reach a human.
//
// Building this surfaced a real, previously-silent gap: app_user (queried
// by ChurnPredictionJob, MilestoneCheckJob and others for "who is staff to
// notify") had zero rows in this environment all session — every staff-
// notification code path has been silently finding nobody and no-op'ing,
// not just this new job. Migration 076 seeds the real admin row that fixes
// all of them.

import { test, expect } from 'playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

const PREFIX = 'e2e-complaint-alert-';

test.afterAll(async () => {
  await pool.query(`DELETE FROM notification_queue WHERE payload->>'text' LIKE $1`, [`${PREFIX}%`]);
  await pool.query(`DELETE FROM sentiment_log WHERE text_content LIKE $1`, [`${PREFIX}%`]);
  await pool.end();
});

async function loginAsAdmin(request: import('playwright/test').APIRequestContext) {
  const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
  expect(login.ok()).toBeTruthy();
}

async function runJob(request: import('playwright/test').APIRequestContext) {
  const res = await request.post('/api/admin/demo-hub/run-job', { data: { name: 'complaint-alert' } });
  expect(res.status()).toBe(200);
  return res.json();
}

test.describe('CA-001 real admin exists (the silent no-op fix)', () => {
  test('app_user has at least one active admin/owner — the recipient every staff-alert job needs', async () => {
    const row = await pool.query(`SELECT id, email FROM app_user WHERE role IN ('admin','owner') AND status='active' LIMIT 1`);
    expect(row.rowCount).toBeGreaterThan(0);
  });
});

test.describe('CA-002 positive — a fresh negative entry gets alerted exactly once', () => {
  test('queues a real notification and marks alerted_at, then does not duplicate on re-run', async ({ request }) => {
    await loginAsAdmin(request);
    const text = `${PREFIX}fresh negative ${Date.now()}`;
    const inserted = await pool.query(
      `INSERT INTO sentiment_log (source, text_content, sentiment, confidence, reason) VALUES ('manual',$1,'negative',0.9,'test fixture') RETURNING id`,
      [text],
    );
    const logId = inserted.rows[0].id;

    await runJob(request);

    const row = await pool.query(`SELECT alerted_at FROM sentiment_log WHERE id = $1`, [logId]);
    expect(row.rows[0].alerted_at).not.toBeNull();

    const notif = await pool.query(`SELECT recipient_address, status, payload FROM notification_queue WHERE idempotency_key = $1`, [`complaint_${logId}`]);
    expect(notif.rowCount).toBe(1);
    expect(notif.rows[0].payload.text).toBe(text);

    // Re-run must not create a second notification for the same row.
    await runJob(request);
    const notifAfter = await pool.query(`SELECT count(*) FROM notification_queue WHERE idempotency_key = $1`, [`complaint_${logId}`]);
    expect(Number(notifAfter.rows[0].count)).toBe(1);
  });
});

test.describe('CA-003 negative — non-negative sentiment and stale rows are never alerted', () => {
  test('a positive-sentiment row is never alerted', async ({ request }) => {
    await loginAsAdmin(request);
    const text = `${PREFIX}positive ${Date.now()}`;
    const inserted = await pool.query(
      `INSERT INTO sentiment_log (source, text_content, sentiment, confidence, reason) VALUES ('manual',$1,'positive',0.9,'test fixture') RETURNING id`,
      [text],
    );
    await runJob(request);
    const row = await pool.query(`SELECT alerted_at FROM sentiment_log WHERE id = $1`, [inserted.rows[0].id]);
    expect(row.rows[0].alerted_at).toBeNull();
  });

  test('a negative row older than the 48h lookback is not alerted', async ({ request }) => {
    await loginAsAdmin(request);
    const text = `${PREFIX}stale negative ${Date.now()}`;
    const inserted = await pool.query(
      `INSERT INTO sentiment_log (source, text_content, sentiment, confidence, reason, created_at)
       VALUES ('manual',$1,'negative',0.9,'test fixture', now() - interval '72 hours') RETURNING id`,
      [text],
    );
    await runJob(request);
    const row = await pool.query(`SELECT alerted_at FROM sentiment_log WHERE id = $1`, [inserted.rows[0].id]);
    expect(row.rows[0].alerted_at).toBeNull();
  });
});

test.describe('CA-004 end to end — real Ollama classification through to a queued alert', () => {
  test('POST /api/social/sentiment classifies a real negative review, then complaint-alert queues it', async ({ request }) => {
    await loginAsAdmin(request);
    const text = `${PREFIX}Ollama classified: the teacher never showed up and nobody explained why. Extremely frustrating and unprofessional.`;

    const classify = await request.post('/api/social/sentiment', { data: { text } });
    expect(classify.status()).toBe(200);
    const classifyBody = await classify.json();
    expect(classifyBody.sentiment).toBe('negative');

    await runJob(request);

    const row = await pool.query(`SELECT alerted_at FROM sentiment_log WHERE text_content = $1`, [text]);
    expect(row.rows[0]?.alerted_at).not.toBeNull();
  });
});
