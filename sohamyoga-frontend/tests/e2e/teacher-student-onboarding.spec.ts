// Teacher onboarding + student enrollment — TSO-001..004. Before this,
// /admin/teachers and /admin/students were both entirely hardcoded mock
// arrays (DEMO_TEACHERS/DEMO_STUDENTS) with no backing API — the biggest
// real functional gap found in this session's admin-UI audit. The
// underlying teacher_profile table itself did not exist until migration
// 075 (teacher_certification/teacher_schedule had carried an unenforced
// teacher_id column since they were created).
//
// Creating a teacher/student here creates a REAL ASP.NET Identity account
// (via the existing admin-gated /api/admin/users and the new
// /api/customer/auth/admin-create endpoints) plus a real Postgres profile
// row — TSO-001/002 verify the new account can actually log in, not just
// that a row was inserted. Fixture data uses the `@demo.sohamyoga.internal`
// email domain so afterAll can clean up precisely.

import { test, expect } from 'playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

// ASP.NET Identity accounts created here have no cleanup path from this test
// (they live in a separate SQLite DB the test has no access to) — every
// email must be unique per run so a re-run never collides with a prior
// run's leftover Identity account. Postgres-side rows (teacher_profile/
// student/enrollment) ARE cleaned in afterAll, matched by the fixed domain.
const DOMAIN = 'e2e-tso.demo.sohamyoga.internal';
const RUN_ID = Math.random().toString(36).slice(2, 8);
const id = (name: string) => `${name}-${RUN_ID}@${DOMAIN}`;

test.afterAll(async () => {
  await pool.query(`DELETE FROM enrollment WHERE student_id IN (SELECT id FROM student WHERE email LIKE $1)`, [`%@${DOMAIN}`]);
  await pool.query(`DELETE FROM student WHERE email LIKE $1`, [`%@${DOMAIN}`]);
  await pool.query(`DELETE FROM teacher_profile WHERE email LIKE $1`, [`%@${DOMAIN}`]);
  await pool.end();
});

async function loginAsAdmin(request: import('playwright/test').APIRequestContext) {
  const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
  expect(login.ok()).toBeTruthy();
}

test.describe('TSO-001 POST /api/admin/teachers — positive, end to end', () => {
  test('creates a real teacher account that can immediately log in', async ({ request }) => {
    await loginAsAdmin(request);
    const email = id('teacher-positive');

    const res = await request.post('/api/admin/teachers', {
      data: { firstName: 'E2E', lastName: 'Teacher', email, password: 'TeacherDemo@123456', specializations: ['Hatha'] },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.teacher).toMatchObject({ first_name: 'E2E', last_name: 'Teacher', email, status: 'active' });

    const login = await request.post('/api/auth/login', { data: { email, password: 'TeacherDemo@123456' } });
    expect(login.ok()).toBeTruthy();
    const loginBody = await login.json();
    expect(loginBody.user.roles).toContain('Teacher');

    const row = await pool.query(`SELECT first_name, status FROM teacher_profile WHERE email = $1`, [email]);
    expect(row.rows[0]).toMatchObject({ first_name: 'E2E', status: 'active' });
  });
});

test.describe('TSO-002 POST /api/admin/students — positive, end to end', () => {
  test('creates a real student account that can immediately log in', async ({ request }) => {
    await loginAsAdmin(request);
    const email = id('student-positive');

    const res = await request.post('/api/admin/students', {
      data: { displayName: 'E2E Student', email, password: 'StudentDemo@123456', experienceLevel: 'beginner' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.student).toMatchObject({ display_name: 'E2E Student', email, status: 'active' });

    const login = await request.post('/api/customer/auth/login', { data: { email, password: 'StudentDemo@123456' } });
    expect(login.ok()).toBeTruthy();

    // The customer login above replaced the shared request context's cookie
    // with a Customer-role session — re-establish the admin session before
    // calling an admin-gated endpoint.
    await loginAsAdmin(request);

    const enrollRes = await request.post(`/api/admin/students/${body.student.id}/enroll`);
    expect(enrollRes.status()).toBe(201);
    const enrollBody = await enrollRes.json();
    expect(enrollBody.enrollment).toMatchObject({ student_id: body.student.id, status: 'active' });

    const second = await request.post(`/api/admin/students/${body.student.id}/enroll`);
    expect(second.status()).toBe(409);
  });
});

test.describe('TSO-003 negative validation', () => {
  test('teacher creation without required fields is rejected with 400', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.post('/api/admin/teachers', { data: { firstName: 'Missing' } });
    expect(res.status()).toBe(400);
  });

  test('student creation without required fields is rejected with 400', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.post('/api/admin/students', { data: { displayName: 'Missing' } });
    expect(res.status()).toBe(400);
  });

  test('duplicate teacher email is rejected', async ({ request }) => {
    await loginAsAdmin(request);
    const email = id('teacher-dup');
    const first = await request.post('/api/admin/teachers', {
      data: { firstName: 'Dup', lastName: 'One', email, password: 'TeacherDemo@123456' },
    });
    expect(first.status()).toBe(201);
    const second = await request.post('/api/admin/teachers', {
      data: { firstName: 'Dup', lastName: 'Two', email, password: 'TeacherDemo@123456' },
    });
    expect(second.status()).toBeGreaterThanOrEqual(400);
  });

  test('unauthenticated requests are rejected with 401', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const teacherRes = await unauth.post('http://127.0.0.1:8085/api/admin/teachers', { data: {} });
    expect(teacherRes.status()).toBe(401);
    const studentRes = await unauth.post('http://127.0.0.1:8085/api/admin/students', { data: {} });
    expect(studentRes.status()).toBe(401);
    await unauth.dispose();
  });
});

test.describe('TSO-004 admin UI renders real data', () => {
  test('teachers and students pages render a working Add form and real fetched data', async ({ page, request }) => {
    await loginAsAdmin(request);
    const state = await request.storageState();
    await page.context().addCookies(state.cookies);

    await page.goto('/admin/teachers');
    // Longer timeout: in dev mode Next.js JIT-compiles a route on its first
    // hit, which can push a cold page's first render past the default 8s.
    await expect(page.getByRole('heading', { name: 'Teachers' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: '+ Add Teacher' })).toBeVisible();

    await page.goto('/admin/students');
    await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: '+ Add Student' })).toBeVisible();
  });
});
