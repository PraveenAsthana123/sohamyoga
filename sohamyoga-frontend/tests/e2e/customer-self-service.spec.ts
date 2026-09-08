// Customer self-service — the "full" feature pass (2026-08-31). Covers 8 new
// real areas (journey, practice journal, bookings, preferences, address,
// invoices, support tickets, loyalty, subscription) plus the honest-mock
// fixes (student/*, ai/pose, ai/progress, community, catalog redirects) and
// the removal of the false "nothing here is a placeholder" claim.
//
// Self-seeding: creates its own real customer in beforeAll and tears it
// down in afterAll, along with anything the tests created. The
// customer_demo <-> student link is a SHARED fixture also relied on by
// customer-interaction-tracking.spec.ts, demo-showcase-hub.spec.ts, and
// console-error-sweep.spec.ts (same check-then-create-never-delete
// convention as customer-interaction-tracking.spec.ts) — this suite must
// leave that link in place, only cleaning up the student-scoped rows its
// own tests created.

import { test, expect } from 'playwright/test';
import { apiUrl } from './support/runtime';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

let customerId: string;
let studentId: string;
const cookies: string[] = [];

async function login(request: import('playwright/test').APIRequestContext) {
  const res = await request.post(apiUrl('/api/customer/auth/login'), {
    data: { email: 'customer_demo@sohamyoga.ca', password: 'CustomerDemo@123456' },
  });
  expect(res.ok()).toBeTruthy();
}

test.beforeAll(async ({ request }) => {
  await login(request);
  const reg = await request.post(apiUrl('/api/customer/complete-registration'), { data: { displayName: 'Demo Customer' } });
  const body = await reg.json();
  customerId = body.customerId;

  // The real resolution path is student.user_id = identity_user_id (see
  // src/lib/resolve-student.ts) -- customer.student_id is never set by any
  // real code path, so linking through it here would test a fiction.
  // student.user_id is UNIQUE + NOT NULL, so this must check-then-create
  // exactly like customer-interaction-tracking.spec.ts's identical fixture,
  // never blind-insert (races with parallel Playwright projects sharing
  // this same fixed demo identity, and with sibling specs).
  const customerRow = await pool.query<{ user_id: string; tenant_id: string }>(`SELECT user_id, tenant_id FROM customer WHERE id = $1`, [customerId]);
  const userId = customerRow.rows[0].user_id;
  const tenantId = customerRow.rows[0].tenant_id;
  const existing = await pool.query<{ id: string }>(`SELECT id FROM student WHERE user_id = $1`, [userId]);
  if (existing.rowCount) {
    studentId = existing.rows[0].id;
  } else {
    const student = await pool.query<{ id: string }>(
      `INSERT INTO student (tenant_id, user_id, display_name, email) VALUES ($1, $2, 'Demo Customer', 'customer_demo@sohamyoga.ca') RETURNING id`,
      [tenantId, userId],
    );
    studentId = student.rows[0].id;
  }
});

test.afterAll(async () => {
  // Safety-net cleanup for every student/customer-scoped table this suite
  // touches, not just the ones an individual test remembers to clean up
  // itself -- WellnessScoreComputeJob in particular is a global job that
  // processes ALL pending student-days, so it can compute a real score for
  // another test's leftover journal entry if that entry isn't gone yet.
  await pool.query(`DELETE FROM wellness_score WHERE student_id = $1`, [studentId]);
  await pool.query(`DELETE FROM student_goal WHERE student_id = $1`, [studentId]);
  await pool.query(`DELETE FROM student_guardian WHERE student_id = $1`, [studentId]);
  await pool.query(`DELETE FROM practice_journal WHERE student_id = $1`, [studentId]);
  await pool.query(`DELETE FROM customer_address WHERE customer_id = $1`, [customerId]);
  await pool.query(`DELETE FROM support_ticket WHERE customer_id = $1`, [customerId]);
  await pool.query(`DELETE FROM subscription_master WHERE customer_id = $1`, [customerId]);
  // customer AND student are the shared fixture (see beforeAll/header comment)
  // -- never deleted here. This line used to delete `customer` unconditionally
  // on every run, contradicting the file's own documented convention and
  // silently breaking every sibling spec (and any manual admin verification)
  // that depends on customer_demo@sohamyoga.ca persisting. Found live 2026-09-01
  // when it deleted the row mid-session, orphaning wellness data referencing it.
  await pool.end();
});

test.describe('CSS-001 auth gating on every new customer endpoint', () => {
  for (const path of [
    '/api/customer/journey', '/api/customer/practice-journal', '/api/customer/bookings',
    '/api/customer/preferences', '/api/customer/address', '/api/customer/invoices',
    '/api/customer/support-tickets', '/api/customer/loyalty', '/api/customer/subscription',
  ]) {
    test(`${path} rejects unauthenticated GET`, async ({ request }) => {
      const res = await request.get(apiUrl(path));
      expect(res.status()).toBe(401);
    });
  }
});

test.describe('CSS-002 My Journey — real gamification data, never fabricated', () => {
  test('honestly reports zero streak/points/attendance for a customer with no activity', async ({ request }) => {
    await login(request);
    const res = await request.get(apiUrl('/api/customer/journey'));
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.streak.current_streak).toBe(0);
    expect(body.pointsBalance).toBe(0);
    expect(body.totalClassesAttended).toBe(0);
    expect(body.earnedBadges).toEqual([]);
    expect(body.lockedBadges.length).toBeGreaterThan(0);
  });
});

test.describe('CSS-003 Practice Journal — real create/validate/list', () => {
  test('rejects an out-of-range mood value', async ({ request }) => {
    await login(request);
    const res = await request.post(apiUrl('/api/customer/practice-journal'), {
      data: { entryDate: '2026-08-30', sessionType: 'home', moodBefore: 9 },
    });
    expect(res.status()).toBe(400);
  });

  test('creates a real entry and it appears in the list', async ({ request }) => {
    await login(request);
    const create = await request.post(apiUrl('/api/customer/practice-journal'), {
      data: { entryDate: '2026-08-29', sessionType: 'home', durationMinutes: 45, moodBefore: 3, moodAfter: 5, energyLevel: 4, notes: 'e2e test entry' },
    });
    expect(create.ok()).toBeTruthy();

    const list = await request.get(apiUrl('/api/customer/practice-journal'));
    const body = await list.json();
    expect(body.hasStudentRecord).toBe(true);
    expect(body.entries.some((e: { notes: string }) => e.notes === 'e2e test entry')).toBe(true);
  });
});

test.describe('CSS-004 Address book — real create/list/delete', () => {
  test('rejects a missing city', async ({ request }) => {
    await login(request);
    const res = await request.post(apiUrl('/api/customer/address'), { data: { line1: '123 Test St' } });
    expect(res.status()).toBe(400);
  });

  test('creates, lists, and deletes a real address', async ({ request }) => {
    await login(request);
    const create = await request.post(apiUrl('/api/customer/address'), {
      data: { label: 'e2e Home', line1: '123 Test St', city: 'Edmonton', state: 'AB', postalCode: 'T5J 0N3' },
    });
    expect(create.ok()).toBeTruthy();
    const { address } = await create.json();

    const list = await request.get(apiUrl('/api/customer/address'));
    const listBody = await list.json();
    expect(listBody.addresses.some((a: { id: string }) => a.id === address.id)).toBe(true);

    const del = await request.delete(apiUrl(`/api/customer/address?id=${address.id}`));
    expect(del.ok()).toBeTruthy();
    const listAfter = await request.get(apiUrl('/api/customer/address'));
    const listAfterBody = await listAfter.json();
    expect(listAfterBody.addresses.some((a: { id: string }) => a.id === address.id)).toBe(false);
  });
});

test.describe('CSS-005 Support tickets — real create/list', () => {
  test('rejects an invalid category', async ({ request }) => {
    await login(request);
    const res = await request.post(apiUrl('/api/customer/support-tickets'), { data: { subject: 'test', category: 'not_a_real_category' } });
    expect(res.status()).toBe(400);
  });

  test('creates a real open ticket', async ({ request }) => {
    await login(request);
    const create = await request.post(apiUrl('/api/customer/support-tickets'), { data: { subject: 'e2e billing question', category: 'billing' } });
    expect(create.ok()).toBeTruthy();
    const { ticket } = await create.json();
    expect(ticket.status).toBe('open');
  });
});

test.describe('CSS-006 Subscription self-service — reuses the real Subscription state machine', () => {
  let subscriptionId: string;

  test.beforeAll(async () => {
    const plan = await pool.query<{ id: string; name: string; plan_type: string }>(`SELECT id, name, plan_type FROM pricing_plan_master WHERE status = 'active' LIMIT 1`);
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO subscription_master (customer_id, plan_id, plan_name, plan_type, status, billing_cycle, billing_amount, billing_cycle_days, expires_at)
       VALUES ($1,$2,$3,$4,'active','monthly',49.99,30, now() + interval '30 days') RETURNING id`,
      [customerId, plan.rows[0].id, plan.rows[0].name, plan.rows[0].plan_type],
    );
    subscriptionId = inserted.rows[0].id;
  });
  test.afterAll(async () => {
    await pool.query(`DELETE FROM subscription_master WHERE id = $1`, [subscriptionId]);
  });

  test('views, pauses, resumes, and cancels — rejecting an invalid transition afterward', async ({ request }) => {
    await login(request);
    const view = await request.get(apiUrl('/api/customer/subscription'));
    const viewBody = await view.json();
    expect(viewBody.subscription.status).toBe('active');

    const pause = await request.patch(apiUrl('/api/customer/subscription'), { data: { action: 'pause', reason: 'e2e test' } });
    expect((await pause.json()).subscription.status).toBe('paused');

    const resume = await request.patch(apiUrl('/api/customer/subscription'), { data: { action: 'resume' } });
    expect((await resume.json()).subscription.status).toBe('active');

    const cancel = await request.patch(apiUrl('/api/customer/subscription'), { data: { action: 'cancel', reason: 'e2e test' } });
    expect((await cancel.json()).subscription.status).toBe('cancelled');

    const invalidNext = await request.patch(apiUrl('/api/customer/subscription'), { data: { action: 'pause', reason: 'x' } });
    expect(invalidNext.status()).toBe(409);
  });

  test('rejects an unknown action', async ({ request }) => {
    await login(request);
    const res = await request.patch(apiUrl('/api/customer/subscription'), { data: { action: 'freeze', from: '2026-01-01', to: '2026-01-05' } });
    expect(res.status()).toBe(400);
  });
});

test.describe('CSS-007 Loyalty — real tier/points read', () => {
  test('reports the real default tier for a new customer', async ({ request }) => {
    await login(request);
    const res = await request.get(apiUrl('/api/customer/loyalty'));
    const body = await res.json();
    expect(body.tier).toBe('standard');
    expect(body.allTiers.length).toBeGreaterThan(0);
  });
});

test.describe('CSS-008 Formerly-mock pages now redirect to their real equivalents', () => {
  const redirects: [string, string][] = [
    ['/student/dashboard', '/customer/journey'],
    ['/student/calendar', '/customer/bookings'],
    ['/student/history', '/customer/bookings'],
    ['/student/challenges', '/customer/journey'],
    ['/student/preferences', '/customer/preferences'],
    ['/ai/progress', '/customer/practice-journal'],
    ['/community', '/community/polls'],
    ['/catalog', '/booking'],
  ];
  for (const [from, to] of redirects) {
    test(`${from} redirects to ${to}`, async ({ page }) => {
      await page.goto(apiUrl(from));
      await expect(page).toHaveURL(new RegExp(to.replace(/\//g, '\\/') + '$'));
    });
  }
});

test.describe('CSS-009 /customer/features no longer makes a false claim', () => {
  test('does not claim every linked feature is real when pose analysis is explicitly not', async ({ page, request }) => {
    await login(request);
    await page.context().addCookies((await request.storageState()).cookies);
    await page.goto(apiUrl('/customer/features'));
    await expect(page.getByText(/not yet available/i).first()).toBeVisible();
    await expect(page.getByText(/nothing here is a placeholder/i)).toHaveCount(0);
  });
});

test.describe('CSS-010 Goals — real structured goal-setting', () => {
  test('rejects an unknown goal code and creates a real one', async ({ request }) => {
    await login(request);
    const bad = await request.post(apiUrl('/api/customer/goals'), { data: { goalCode: 'not_a_real_goal' } });
    expect(bad.status()).toBe(400);

    const create = await request.post(apiUrl('/api/customer/goals'), { data: { goalCode: 'stress_relief', priority: 1 } });
    expect(create.ok()).toBeTruthy();

    const list = await request.get(apiUrl('/api/customer/goals'));
    const body = await list.json();
    expect(body.goals.some((g: { goal_code: string }) => g.goal_code === 'stress_relief')).toBe(true);

    await pool.query(`DELETE FROM student_goal WHERE student_id = $1`, [studentId]);
  });
});

test.describe('CSS-011 Emergency contacts — real create/delete', () => {
  test('rejects an invalid relationship and creates/deletes a real contact', async ({ request }) => {
    await login(request);
    const bad = await request.post(apiUrl('/api/customer/emergency-contacts'), { data: { guardianName: 'x', relationship: 'not_real' } });
    expect(bad.status()).toBe(400);

    const create = await request.post(apiUrl('/api/customer/emergency-contacts'), {
      data: { guardianName: 'e2e Contact', relationship: 'spouse', phone: '555-0000', isEmergency: true },
    });
    expect(create.ok()).toBeTruthy();
    const { contact } = await create.json();

    const del = await request.delete(apiUrl(`/api/customer/emergency-contacts?id=${contact.id}`));
    expect(del.ok()).toBeTruthy();
  });
});

test.describe('CSS-012 My Plan and Pose Mastery — honest empty states', () => {
  test('reports no plan and no assessments for a student with none assigned', async ({ request }) => {
    await login(request);
    const plan = await request.get(apiUrl('/api/customer/plan'));
    expect((await plan.json()).plans).toEqual([]);

    const mastery = await request.get(apiUrl('/api/customer/pose-mastery'));
    const masteryBody = await mastery.json();
    expect(masteryBody.assessments).toEqual([]);
    expect(masteryBody.report.exploring).toBe(0);
  });
});

test.describe('CSS-013 Wellness score — real computation from practice journal, never fabricated', () => {
  test('the compute job derives the exact composite from mood/energy just logged', async ({ request }) => {
    await login(request);
    const entryDate = '2026-07-15';
    try {
      const create = await request.post(apiUrl('/api/customer/practice-journal'), {
        data: { entryDate, sessionType: 'home', moodAfter: 3, energyLevel: 4, notes: 'e2e wellness feed' },
      });
      expect(create.ok()).toBeTruthy();

      await request.post(apiUrl('/api/auth/login'), { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
      const run = await request.post(apiUrl('/api/admin/demo-hub/run-job'), { data: { name: 'wellness-score-compute' } });
      expect(run.ok()).toBeTruthy();

      await login(request);
      const wellness = await request.get(apiUrl('/api/customer/wellness'));
      const body = await wellness.json();
      const score = body.scores.find((s: { score_date: string }) => s.score_date === entryDate);
      expect(score).toBeTruthy();
      // mood_after=3 -> mood_score=6, energy_level=4 -> energy_score=8, composite = round(avg(6,8)*10) = 70
      expect(score.mood_score).toBe(6);
      expect(score.energy_score).toBe(8);
      expect(score.composite_score).toBe(70);
    } finally {
      await pool.query(`DELETE FROM wellness_score WHERE student_id = $1 AND score_date = $2`, [studentId, entryDate]);
      await pool.query(`DELETE FROM practice_journal WHERE student_id = $1 AND entry_date = $2`, [studentId, entryDate]);
    }
  });
});

test.describe('CSS-014 Settings — real feature opt-out reflected in the sidebar', () => {
  test('toggling a feature off hides it from the customer nav', async ({ page, request }) => {
    await login(request);
    try {
      const patch = await request.patch(apiUrl('/api/customer/settings'), { data: { disabledFeatures: ['loyalty'] } });
      expect(patch.ok()).toBeTruthy();

      await page.context().addCookies((await request.storageState()).cookies);
      await page.goto(apiUrl('/customer/dashboard'));
      // Real, intermittent race found live 2026-09-01 (~30% of runs):
      // addCookies() occasionally hasn't taken effect before this goto
      // resolves, landing on the marketing site's login screen instead of
      // the authenticated dashboard. Detect that and retry once rather
      // than resorting to a fixed sleep, which would only mask, not fix,
      // the underlying timing gap.
      if (await page.getByRole('heading', { name: 'Welcome Back' }).isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.context().addCookies((await request.storageState()).cookies);
        await page.goto(apiUrl('/customer/dashboard'));
      }
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('link', { name: 'Loyalty' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'My Journey' }).first()).toBeVisible();
    } finally {
      await request.patch(apiUrl('/api/customer/settings'), { data: { disabledFeatures: [] } });
    }
  });

  test('rejects an unknown feature key', async ({ request }) => {
    await login(request);
    const res = await request.patch(apiUrl('/api/customer/settings'), { data: { disabledFeatures: ['not_a_real_feature'] } });
    expect(res.status()).toBe(400);
  });
});
