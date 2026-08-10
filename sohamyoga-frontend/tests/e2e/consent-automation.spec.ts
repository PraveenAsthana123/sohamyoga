// Consent Automation — POST /api/analytics/consent + the consent gate inside
// POST /api/analytics/events. Exercises the API directly (Playwright's
// `request` fixture) against the real server + real Postgres, matching this
// project's ollama-and-DB-are-real testing convention rather than mocks.
//
// Master/fixture data is self-seeding and self-cleaning: every anonymousId
// used here carries the `e2e-consent-` prefix so a single afterAll sweep can
// tear down exactly what this file created, safely re-runnable in CI.

import { test, expect, type APIRequestContext } from 'playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

const PREFIX = 'e2e-consent-';
const id = (name: string) => `${PREFIX}${name}`;

async function postConsent(request: APIRequestContext, body: Record<string, unknown>) {
  return request.post('/api/analytics/consent', { data: body });
}
async function postEvent(request: APIRequestContext, body: Record<string, unknown>) {
  return request.post('/api/analytics/events', {
    data: { eventType: 'page_view', name: 'page_view', url: 'https://sohamyoga.test/e2e', ...body },
  });
}

test.afterAll(async () => {
  await pool.query(`DELETE FROM tracking_event WHERE anonymous_id LIKE $1`, [`${PREFIX}%`]);
  await pool.query(`DELETE FROM tracking_session WHERE anonymous_id LIKE $1`, [`${PREFIX}%`]);
  await pool.query(`DELETE FROM analytics_consent_record WHERE anonymous_id LIKE $1`, [`${PREFIX}%`]);
  await pool.end();
});

test.describe('CONSENT-001 POST /api/analytics/consent — positive', () => {
  test('a valid level is accepted and persisted with granted_at set', async ({ request }) => {
    const anonymousId = id('positive-1');
    const res = await postConsent(request, { anonymousId, level: 'analytics' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, level: 'analytics', granted: true });
    expect(body.grantedAt).toBeTruthy();

    const row = await pool.query(
      `SELECT level, granted, granted_at, ip_hash, user_agent FROM analytics_consent_record WHERE anonymous_id=$1`,
      [anonymousId],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].level).toBe('analytics');
    expect(row.rows[0].granted).toBe(true);
    expect(row.rows[0].granted_at).not.toBeNull();
    // ip_hash must never contain a raw, unhashed IP — a SHA-256 hex digest is 64 chars.
    expect(row.rows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

test.describe('CONSENT-005 GET /api/analytics/consent — admin records table', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get('http://127.0.0.1:8085/api/analytics/consent');
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });

  test('an authenticated admin sees the individual record in the records list, not just the aggregate', async ({ request }) => {
    const anonymousId = id('admin-records-visible');
    await postConsent(request, { anonymousId, level: 'marketing' });

    const login = await request.post('/api/auth/login', { data: { email: 'admin@sohamyoga.ca', password: 'Admin@123456' } });
    expect(login.ok()).toBeTruthy();

    const res = await request.get('/api/analytics/consent');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.distribution)).toBe(true);
    expect(Array.isArray(body.records)).toBe(true);
    expect(body.records.some((r: { anonymousId: string; level: string }) => r.anonymousId === anonymousId && r.level === 'marketing')).toBe(true);
  });
});

test.describe('CONSENT-002 POST /api/analytics/consent — negative', () => {
  test('an unrecognised level is rejected with 400 and nothing is written', async ({ request }) => {
    const anonymousId = id('negative-badlevel');
    const res = await postConsent(request, { anonymousId, level: 'bogus' });
    expect(res.status()).toBe(400);
    const count = await pool.query(`SELECT COUNT(*) FROM analytics_consent_record WHERE anonymous_id=$1`, [anonymousId]);
    expect(Number(count.rows[0].count)).toBe(0);
  });

  test('a missing anonymousId is rejected with 400', async ({ request }) => {
    const res = await postConsent(request, { level: 'analytics' });
    expect(res.status()).toBe(400);
  });

  test('a missing level is rejected with 400', async ({ request }) => {
    const res = await postConsent(request, { anonymousId: id('negative-nolevel') });
    expect(res.status()).toBe(400);
  });
});

test.describe('CONSENT-003 POST /api/analytics/consent — boundary', () => {
  test('level=none is accepted but recorded as not granted, with no granted_at', async ({ request }) => {
    const anonymousId = id('boundary-none');
    const res = await postConsent(request, { anonymousId, level: 'none' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, level: 'none', granted: false, grantedAt: null });
  });

  test('consent is append-only: granting then revoking keeps both rows, latest wins', async ({ request }) => {
    const anonymousId = id('boundary-append-only');
    await postConsent(request, { anonymousId, level: 'all' });
    await postConsent(request, { anonymousId, level: 'none' });

    const rows = await pool.query(
      `SELECT level, granted FROM analytics_consent_record WHERE anonymous_id=$1 ORDER BY created_at`,
      [anonymousId],
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0]).toMatchObject({ level: 'all', granted: true });
    expect(rows.rows[1]).toMatchObject({ level: 'none', granted: false });
  });
});

test.describe('CONSENT-004 events consent gate — end to end', () => {
  test('an analytics event is collected once analytics consent is granted', async ({ request }) => {
    const anonymousId = id('e2e-granted');
    const consentRes = await postConsent(request, { anonymousId, level: 'analytics' });
    expect(consentRes.status()).toBe(200);

    const eventRes = await postEvent(request, { anonymousId, eventType: 'page_view', name: 'page_view' });
    expect(eventRes.status()).toBe(200);
    const eventBody = await eventRes.json();
    expect(eventBody).toMatchObject({ ok: true, persisted: true, status: 'collected' });

    const row = await pool.query(
      `SELECT status, consent_level, properties FROM tracking_event WHERE anonymous_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [anonymousId],
    );
    expect(row.rows[0]).toMatchObject({ status: 'collected', consent_level: 'analytics' });

    const session = await pool.query(`SELECT consent_level FROM tracking_session WHERE anonymous_id=$1`, [anonymousId]);
    expect(session.rows[0].consent_level).toBe('analytics');
  });

  test('an analytics event is dropped (not stored with properties) when no consent record exists', async ({ request }) => {
    const anonymousId = id('e2e-no-consent');
    const res = await postEvent(request, {
      anonymousId, eventType: 'click', name: 'click',
      properties: { shouldNotBeStored: 'value' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, persisted: true, status: 'dropped' });

    const row = await pool.query(
      `SELECT status, consent_level, properties FROM tracking_event WHERE anonymous_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [anonymousId],
    );
    expect(row.rows[0].status).toBe('dropped');
    expect(row.rows[0].consent_level).toBe('none');
    expect(row.rows[0].properties).toEqual({});
  });

  test('boundary: essential/conversion events are always collected, even with zero consent', async ({ request }) => {
    const anonymousId = id('e2e-essential-no-consent');
    const res = await postEvent(request, { anonymousId, eventType: 'payment_completed', name: 'payment_completed' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, persisted: true, status: 'collected' });
  });

  test('boundary: revoking consent mid-session drops the next analytics event again', async ({ request }) => {
    const anonymousId = id('e2e-revoke-midflow');
    await postConsent(request, { anonymousId, level: 'analytics' });
    const before = await postEvent(request, { anonymousId, eventType: 'page_view', name: 'page_view' });
    expect((await before.json()).status).toBe('collected');

    await postConsent(request, { anonymousId, level: 'none' });
    const after = await postEvent(request, { anonymousId, eventType: 'page_view', name: 'page_view' });
    expect((await after.json()).status).toBe('dropped');
  });

  test('negative: events endpoint still rejects a request with no anonymousId', async ({ request }) => {
    const res = await postEvent(request, { anonymousId: undefined });
    expect(res.status()).toBe(400);
  });
});
