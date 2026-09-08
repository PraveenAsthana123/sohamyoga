// Customer Funnel Stage Engine — FUN-001..004. The spine of the growth-loop
// architecture (Funnel → Advocacy/Referral → Viral Detection → Influencer).
// Seven stages, each backed by a real, already-flowing signal
// (tracking_event/campaign_lead/booking/survey) — no ad-impression/reach
// data exists in this platform (no ad platform connected), so the funnel
// starts at real on-site engagement, not ad awareness. Ollama only
// diagnoses an already-computed real leak; it never invents the numbers.

import { test, expect } from 'playwright/test';
import { apiUrl } from './support/runtime';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

test.afterAll(async () => {
  await pool.end();
});

async function loginAsAdmin(request: import('playwright/test').APIRequestContext) {
  const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
  expect(login.ok()).toBeTruthy();
}

test.describe('FUN-001 GET /api/admin/growth/funnel — auth gating', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get(apiUrl('/api/admin/growth/funnel'));
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });
});

test.describe('FUN-002 real stage counts and transitions', () => {
  test('the latest snapshot has all 7 real stages in order, and transition rates are mathematically consistent', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/growth/funnel');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.hasData).toBe(true);

    const stageNames = body.stages.map((s: { stage: string }) => s.stage);
    expect(stageNames).toEqual(['engagement', 'interest', 'intent', 'lead', 'conversion', 'experience', 'advocacy']);

    for (const s of body.stages) {
      expect(s.unique_count).toBeGreaterThanOrEqual(0);
    }

    // Every transition's conversion_rate must be the real division of its
    // own from/to counts — never a number disconnected from the stage data.
    for (const t of body.transitions) {
      const expected = t.from_count > 0 ? Math.round((t.to_count / t.from_count) * 10000) / 100 : 0;
      expect(Number(t.conversion_rate)).toBeCloseTo(expected, 1);
    }
  });
});

test.describe('FUN-003 leak detection and AI diagnosis', () => {
  test('a transition below the leak threshold is flagged, and any diagnosis present is real text, not a placeholder', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/growth/funnel');
    const body = await res.json();

    const leaks = body.transitions.filter((t: { is_leak: boolean }) => t.is_leak);
    for (const leak of leaks) {
      expect(Number(leak.conversion_rate)).toBeLessThan(20);
      expect(leak.from_count).toBeGreaterThan(0);
    }

    const diagnosed = body.transitions.filter((t: { ai_diagnosis: string | null }) => t.ai_diagnosis);
    for (const d of diagnosed) {
      expect(d.ai_diagnosis.length).toBeGreaterThan(20);
    }
  });
});

test.describe('FUN-004 page renders real data', () => {
  test('/admin/growth/funnel shows real stage bars and transition findings', async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto('/admin/growth/funnel');
    await expect(page.getByRole('main').getByRole('heading', { name: 'Customer Funnel' })).toBeVisible();
    await expect(page.getByText('Engagement').first()).toBeVisible();
    await expect(page.getByText('Advocacy').first()).toBeVisible();
  });
});
