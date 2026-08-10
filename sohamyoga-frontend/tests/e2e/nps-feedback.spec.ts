// NPS feedback pipeline — GET/POST /api/survey/post-class-experience/respond
// (public, no auth — customers submit these) and GET /api/survey/nps-summary
// (admin-gated). NpsInvitationJob and NpsCalculationJob are cron-triggered,
// not HTTP, so they're covered by direct live-verification against the real
// Ollama daemon + Postgres (the npx tsx -e pattern), not here — this suite
// covers the HTTP-facing surface a customer and an admin actually use.
//
// Self-seeding/self-cleaning: creates its own student/class_session/booking/
// invitation fixture rows (prefix e2e-nps-) and its own survey_response rows
// via real POSTs, all swept in afterAll. The post-class-experience survey
// itself is real seed data (migration 067), not created by this file.

import { test, expect } from 'playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

const ADMIN_EMAIL = 'admin@sohamyoga.ca';
const ADMIN_PASSWORD = 'Admin@123456';

let surveyId: string;
const createdInvitationTokens: string[] = [];
const createdResponseIds: string[] = [];

test.beforeAll(async () => {
  const survey = await pool.query<{ id: string }>(`SELECT id FROM survey WHERE slug = 'post-class-experience'`);
  surveyId = survey.rows[0].id;
});

test.afterAll(async () => {
  await pool.query(`DELETE FROM survey_answer WHERE response_id = ANY($1::uuid[])`, [createdResponseIds]);
  await pool.query(`DELETE FROM survey_response WHERE id = ANY($1::uuid[])`, [createdResponseIds]);
  await pool.query(`DELETE FROM survey_invitation WHERE token = ANY($1::text[])`, [createdInvitationTokens]);
  await pool.query(
    `UPDATE survey SET response_count = GREATEST(0, response_count - $2), completion_count = GREATEST(0, completion_count - $2) WHERE id = $1`,
    [surveyId, createdResponseIds.length],
  );
  await pool.end();
});

// survey_invitation has UNIQUE(survey_id, email) — one invitation per person
// per survey, ever — so each seeded invitation needs its own unique email.
async function seedInvitation(): Promise<string> {
  const suffix = Math.random().toString(36).slice(2, 12);
  const token = `e2e-nps-${suffix}`;
  await pool.query(
    `INSERT INTO survey_invitation (survey_id, email, token, sent_by, expires_at) VALUES ($1,$2,$3,$4, now() + INTERVAL '14 days')`,
    [surveyId, `e2e-nps-${suffix}@example.com`, token, '00000000-0000-0000-0000-000000000000'],
  );
  createdInvitationTokens.push(token);
  return token;
}

test.describe('NPS-001 GET respond — positive', () => {
  test('returns the real NPS and free-text questions for the seeded survey', async ({ request }) => {
    const res = await request.get('/api/survey/post-class-experience/respond');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.questions.find((q: { type: string }) => q.type === 'nps')).toMatchObject({
      ratingMin: 0, ratingMax: 10, required: true,
    });
    expect(body.questions.some((q: { type: string }) => q.type === 'long_text')).toBe(true);
  });

  test('an unknown slug returns 404', async ({ request }) => {
    const res = await request.get('/api/survey/does-not-exist/respond');
    expect(res.status()).toBe(404);
  });
});

test.describe('NPS-002 POST respond — negative', () => {
  test('a non-integer npsScore is rejected with 400', async ({ request }) => {
    const res = await request.post('/api/survey/post-class-experience/respond', { data: { npsScore: 7.5 } });
    expect(res.status()).toBe(400);
  });

  test('a score above the question range is rejected with 400', async ({ request }) => {
    const res = await request.post('/api/survey/post-class-experience/respond', { data: { npsScore: 11 } });
    expect(res.status()).toBe(400);
  });

  test('a score below the question range is rejected with 400', async ({ request }) => {
    const res = await request.post('/api/survey/post-class-experience/respond', { data: { npsScore: -1 } });
    expect(res.status()).toBe(400);
  });

  test('an invalid token is rejected with 400', async ({ request }) => {
    const res = await request.post('/api/survey/post-class-experience/respond', { data: { token: 'not-a-real-token', npsScore: 5 } });
    expect(res.status()).toBe(400);
  });

  test('reasonText over 4000 characters is rejected with 400', async ({ request }) => {
    const res = await request.post('/api/survey/post-class-experience/respond', {
      data: { npsScore: 5, reasonText: 'x'.repeat(4001) },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('NPS-003 POST respond — boundary', () => {
  test('score 0 (minimum) is accepted', async ({ request }) => {
    const res = await request.post('/api/survey/post-class-experience/respond', { data: { npsScore: 0 } });
    expect(res.status()).toBe(200);
    createdResponseIds.push((await res.json()).responseId);
  });

  test('score 10 (maximum) is accepted', async ({ request }) => {
    const res = await request.post('/api/survey/post-class-experience/respond', { data: { npsScore: 10 } });
    expect(res.status()).toBe(200);
    createdResponseIds.push((await res.json()).responseId);
  });

  test('reusing a token whose invitation is already completed is rejected with 409', async ({ request }) => {
    const token = await seedInvitation();
    const first = await request.post('/api/survey/post-class-experience/respond', { data: { token, npsScore: 9 } });
    expect(first.status()).toBe(200);
    createdResponseIds.push((await first.json()).responseId);

    const second = await request.post('/api/survey/post-class-experience/respond', { data: { token, npsScore: 3 } });
    expect(second.status()).toBe(409);
  });
});

test.describe('NPS-004 end to end — invitation token to submitted response', () => {
  test('a fresh invitation token can be used exactly once and marks the invitation completed', async ({ request }) => {
    const token = await seedInvitation();

    const res = await request.post('/api/survey/post-class-experience/respond', {
      data: { token, npsScore: 6, reasonText: 'It was fine, nothing special.' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    createdResponseIds.push(body.responseId);

    const invitation = await pool.query(`SELECT status, completed_at FROM survey_invitation WHERE token = $1`, [token]);
    expect(invitation.rows[0].status).toBe('completed');
    expect(invitation.rows[0].completed_at).not.toBeNull();

    const answer = await pool.query(
      `SELECT value_number FROM survey_answer WHERE response_id = $1 AND question_type = 'nps'`,
      [body.responseId],
    );
    expect(Number(answer.rows[0].value_number)).toBe(6);
  });
});

test.describe('NPS-005 GET nps-summary — admin auth', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get('http://127.0.0.1:8085/api/survey/nps-summary');
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });

  test('an authenticated admin sees the real post-class-experience survey in the list', async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    expect(login.ok()).toBeTruthy();

    const res = await request.get('/api/survey/nps-summary');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.surveys.some((s: { title: string }) => s.title === 'Post-Class Experience')).toBe(true);
  });
});

test.describe('NPS-006 GET nps-records — individual invitation/response rows', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get('http://127.0.0.1:8085/api/survey/nps-records');
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });

  test('a fresh invitation and its submitted response both appear as individual rows', async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    expect(login.ok()).toBeTruthy();

    const token = await seedInvitation();
    const submit = await request.post('/api/survey/post-class-experience/respond', { data: { token, npsScore: 8 } });
    expect(submit.status()).toBe(200);
    createdResponseIds.push((await submit.json()).responseId);

    const res = await request.get('/api/survey/nps-records');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.invitations.some((i: { id: string; status: string }) => i.status === 'completed')).toBe(true);
    expect(body.responses.some((r: { npsScore: number }) => r.npsScore === 8)).toBe(true);
  });
});
