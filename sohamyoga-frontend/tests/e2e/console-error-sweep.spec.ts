// Console/runtime error sweep — CONSOLE-001. The existing Chrome DevTools
// Protocol test (unified-quality.spec.ts) only ever checked one page
// (/catalog). This session added ~9 new admin pages (Demo Hub with 5 tabs,
// AI Governance, teachers/students list + detail, the social scheduler,
// Guided Simulation) with zero console/runtime-error verification —
// "f12 error" checking was a named requirement that only ever covered one
// route. This sweeps all of them for uncaught exceptions, console.error
// calls, and failed network requests.
//
// A page creates a real fixture (teacher/student ids) that needs to exist
// for the two [id] detail routes — created fresh per run and cleaned up in
// afterAll, same self-seeding convention as the rest of this suite.

import { test, expect } from 'playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

const FIXTURE_EMAIL = `e2e-console-sweep-${Math.random().toString(36).slice(2, 8)}@demo.sohamyoga.internal`;
let teacherId = '';
let studentId = '';

test.beforeAll(async () => {
  const student = await pool.query(`SELECT id FROM student LIMIT 1`);
  studentId = student.rows[0]?.id ?? '';
});

test.afterAll(async () => {
  await pool.query(`DELETE FROM teacher_profile WHERE email = $1`, [FIXTURE_EMAIL]);
  await pool.end();
});

const STATIC_ROUTES = [
  '/admin/demo-hub',
  '/admin/ai-governance',
  '/admin/teachers',
  '/admin/students',
  '/admin/social/scheduler',
  '/admin/simulation',
  '/customer/features',
];

// Console messages that are known-expected, not bugs — e.g. React dev-mode
// warnings that don't occur in production builds. Kept short and specific
// on purpose: this list should never grow to swallow a real regression.
const IGNORABLE_PATTERNS = [/Download the React DevTools/i];

async function sweepPage(page: import('playwright/test').Page, url: string) {
  const errors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  const consoleHandler = (msg: import('playwright/test').ConsoleMessage) => {
    if (msg.type() === 'error' && !IGNORABLE_PATTERNS.some(p => p.test(msg.text()))) errors.push(msg.text());
  };
  const pageErrorHandler = (err: Error) => pageErrors.push(err.message);
  const requestFailedHandler = (req: import('playwright/test').Request) => {
    const isCancelledNextPrefetch = req.url().includes('_rsc=') && req.failure()?.errorText === 'net::ERR_ABORTED';
    if (isCancelledNextPrefetch) return;
    // /public/v1 calls to Postiz are EXPECTED to fail in this environment
    // (no API key configured yet — a documented, honest blocker, not a bug).
    if (!req.url().includes('postiz') && !req.url().includes('15081')) failedRequests.push(`${req.method()} ${req.url()}`);
  };

  page.on('console', consoleHandler);
  page.on('pageerror', pageErrorHandler);
  page.on('requestfailed', requestFailedHandler);

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500); // let client-side fetches settle

  page.off('console', consoleHandler);
  page.off('pageerror', pageErrorHandler);
  page.off('requestfailed', requestFailedHandler);

  return { errors, pageErrors, failedRequests };
}

test.describe('CONSOLE-001 admin/customer pages load with zero console errors', () => {
  for (const route of STATIC_ROUTES) {
    test(`${route} has no console errors, page errors, or failed requests`, async ({ page, request }) => {
      const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
      expect(login.ok()).toBeTruthy();
      if (route.startsWith('/customer')) {
        const customerLogin = await page.request.post('/api/customer/auth/login', { data: { email: 'customer_demo@sohamyoga.ca', password: 'CustomerDemo@123456' } });
        expect(customerLogin.ok()).toBeTruthy();
      } else {
        const state = await request.storageState();
        await page.context().addCookies(state.cookies);
      }

      const { errors, pageErrors, failedRequests } = await sweepPage(page, route);
      expect(errors, `console.error on ${route}`).toEqual([]);
      expect(pageErrors, `uncaught exception on ${route}`).toEqual([]);
      expect(failedRequests, `failed network request on ${route}`).toEqual([]);
    });
  }
});

test.describe('CONSOLE-002 detail pages (dynamic route param) have no console errors', () => {
  test('/admin/teachers/[id] with a real teacher', async ({ page, request }) => {
    await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    const state = await request.storageState();
    await page.context().addCookies(state.cookies);

    const create = await page.request.post('/api/admin/teachers', {
      data: { firstName: 'Console', lastName: 'Sweep', email: FIXTURE_EMAIL, password: 'TeacherDemo@123456', bio: 'console sweep fixture' },
    });
    expect(create.status()).toBe(201);
    teacherId = (await create.json()).teacher.id;

    const { errors, pageErrors, failedRequests } = await sweepPage(page, `/admin/teachers/${teacherId}`);
    expect(errors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });

  test('/admin/students/[id] with the real seeded student', async ({ page, request }) => {
    test.skip(!studentId, 'no student row exists in this environment');
    await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    const state = await request.storageState();
    await page.context().addCookies(state.cookies);

    const { errors, pageErrors, failedRequests } = await sweepPage(page, `/admin/students/${studentId}`);
    expect(errors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});

test.describe('CONSOLE-003 Demo Hub tabs each load without introducing errors', () => {
  test('Catalog, Sequence Flows, Reports, Dashboard and Related Tooling tabs are all clean', async ({ page, request }) => {
    await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    const state = await request.storageState();
    await page.context().addCookies(state.cookies);

    const errors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error' && !IGNORABLE_PATTERNS.some(p => p.test(msg.text()))) errors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto('/admin/demo-hub', { waitUntil: 'networkidle' });
    for (const tabName of ['Sequence Flows', 'Reports', 'Dashboard', 'Related Tooling', 'Use Case Catalog']) {
      await page.getByRole('button', { name: new RegExp(tabName) }).click();
      await page.waitForTimeout(400);
    }

    expect(errors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
