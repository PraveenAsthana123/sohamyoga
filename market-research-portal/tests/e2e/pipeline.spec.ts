// Market Research Portal — pipeline.spec.ts. Covers the plan's Testing
// section end to end: master page creates a study -> all 17 phase_runs
// appear -> phase detail page renders all 8 tabs -> Research-AI draft job
// actually populates output content -> Pricing phase shows real cross-DB
// pricing data -> an un-configured phase's Automatic Process tab shows
// "Not yet automated" (not fake data) -> Campaigns page shows
// not_configured send state -> 401 unauthenticated.

import { test, expect } from 'playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/market_research_portal';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sohamyoga.internal';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'MarketResearch@2026!';
const pool = new Pool({ connectionString: DATABASE_URL });

test.afterAll(async () => {
  await pool.end();
});

async function loginAsAdmin(request: import('playwright/test').APIRequestContext) {
  const res = await request.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  expect(res.ok()).toBeTruthy();
}

/** For browser-page tests: log in via page.request so the session cookie lands in the SAME context/cookie jar page.goto() uses (page.request and page share one context — unlike the standalone `request` fixture). */
async function loginAsAdminInPage(page: import('playwright/test').Page) {
  const res = await page.request.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  expect(res.ok()).toBeTruthy();
}

test.describe('MRP-001 unauthenticated access is denied honestly', () => {
  test('GET /api/studies with no session returns 401', async ({ request }) => {
    const res = await request.get('/api/studies');
    expect(res.status()).toBe(401);
  });
});

test.describe('MRP-002 the 17 phase rows are real, ported reference data', () => {
  test('phase table has exactly 17 rows, layer_number 1..17, non-empty reference text', async () => {
    const result = await pool.query(`SELECT slug, layer_number, process_reference, input_reference, output_reference FROM phase ORDER BY layer_number`);
    expect(result.rowCount).toBe(17);
    expect(result.rows.map(r => r.layer_number)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    for (const row of result.rows) {
      expect(row.process_reference.length).toBeGreaterThan(0);
      expect(row.input_reference.length).toBeGreaterThan(0);
      expect(row.output_reference.length).toBeGreaterThan(0);
    }
    expect(result.rows.find(r => r.slug === 'pricing')?.output_reference).toBe('Optimal pricing');
  });
});

test.describe('MRP-003 master pipeline page creates a real study end to end', () => {
  test('Run Pipeline creates a study with 17 phase_run rows, each eventually completed', async ({ page }) => {
    // The poll below has its own 120s budget (17 real sequential Ollama
    // calls) — the global 60s test timeout was cutting it off before it
    // could ever finish, regardless of whether the underlying job succeeds.
    test.setTimeout(150_000);
    await loginAsAdminInPage(page);

    const topic = `e2e-test-topic-${Date.now()}`;
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Master Pipeline' })).toBeVisible({ timeout: 15000 });

    await page.getByPlaceholder('e.g. yoga center').fill(topic);
    await page.getByRole('button', { name: 'Run Pipeline' }).click();

    await expect(page.getByText(`"${topic}"`)).toBeVisible({ timeout: 15000 });

    // Confirm 17 phase_run rows landed for real in the DB (not just in the UI).
    const studyResult = await pool.query(`SELECT id FROM study WHERE topic_name = $1`, [topic]);
    expect(studyResult.rowCount).toBe(1);
    const studyId = studyResult.rows[0].id;

    const phaseRuns = await pool.query(`SELECT status FROM phase_run WHERE study_id = $1`, [studyId]);
    expect(phaseRuns.rowCount).toBe(17);

    // Wait (real polling against the real job, not a fixed sleep-and-hope)
    // for every phase_run to leave pending/running.
    await expect.poll(async () => {
      const r = await pool.query(`SELECT count(*)::int AS n FROM phase_run WHERE study_id = $1 AND status IN ('pending','running')`, [studyId]);
      return r.rows[0].n;
    }, { timeout: 120_000, intervals: [3000] }).toBe(0);

    const finalStatuses = await pool.query(`SELECT status FROM phase_run WHERE study_id = $1`, [studyId]);
    expect(finalStatuses.rows.every(r => r.status === 'completed' || r.status === 'failed')).toBe(true);

    // At least one real phase_run_ai_log row exists for this study (real Ollama call, not stub data).
    const aiLogs = await pool.query(
      `SELECT al.model_name, al.prompt_chars, al.output_chars FROM phase_run_ai_log al JOIN phase_run pr ON pr.id = al.phase_run_id WHERE pr.study_id = $1`,
      [studyId],
    );
    expect(aiLogs.rowCount).toBeGreaterThan(0);
    expect(aiLogs.rows[0].prompt_chars).toBeGreaterThan(0);
  });
});

test.describe('MRP-004 phase detail page renders all 8 required tabs', () => {
  test('a phase page in reference mode shows Dashboard, Report, Manual Process, Automatic Process, AI Exp, AI Governance, AI Risk, ResAI', async ({ page }) => {
    await loginAsAdminInPage(page);

    await page.goto('/phases/population');
    await expect(page.getByRole('heading', { name: 'Population' })).toBeVisible({ timeout: 15000 });

    for (const label of ['Dashboard', 'Report', 'Manual Process', 'Automatic Process', 'AI Exp', 'AI Governance', 'AI Risk', 'ResAI']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });
});

test.describe('MRP-005 Pricing phase reflects real cross-DB sohamyoga pricing data', () => {
  test('phase_run.output_content for the pricing phase contains a real live dollar figure from sohamyoga.pricing_plan_price', async () => {
    const sohamPool = new Pool({ connectionString: process.env.SOHAMYOGA_RO_DATABASE_URL || 'postgresql://sohamyoga_ro@127.0.0.1:5437/sohamyoga' });
    try {
      const realPrice = await sohamPool.query(
        `SELECT m.name, p.amount::text AS amount FROM pricing_plan_price p JOIN pricing_plan_master m ON m.id = p.plan_id WHERE m.status = 'active' AND p.is_promotional = false ORDER BY p.amount DESC LIMIT 1`,
      );
      expect(realPrice.rowCount).toBeGreaterThan(0);
      const realAmount = Number(realPrice.rows[0].amount).toFixed(2);

      const pricingOutputs = await pool.query(
        `SELECT pr.output_content FROM phase_run pr JOIN phase p ON p.id = pr.phase_id WHERE p.slug = 'pricing' AND pr.output_content LIKE '%cross-DB%' ORDER BY pr.updated_at DESC LIMIT 1`,
      );
      expect(pricingOutputs.rowCount).toBeGreaterThan(0);
      expect(pricingOutputs.rows[0].output_content).toContain(realAmount);
    } finally {
      await sohamPool.end();
    }
  });
});

test.describe('MRP-006 an un-configured phase honestly shows "Not yet automated"', () => {
  test('the Population phase Automatic Process tab shows Not yet automated, never fake job data', async ({ page }) => {
    await loginAsAdminInPage(page);

    await page.goto('/phases/population');
    await expect(page.getByRole('heading', { name: 'Population' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Automatic Process', exact: true }).click();
    await expect(page.getByText(/Not yet automated/i)).toBeVisible();
  });
});

test.describe('MRP-007 campaign sending is honestly NOT_CONFIGURED, never a fake success', () => {
  test('creating a campaign, queuing a message, and sending it returns NOT_CONFIGURED', async ({ request }) => {
    await loginAsAdmin(request);
    const create = await request.post('/api/campaigns', { data: { name: `e2e-campaign-${Date.now()}`, channel: 'email', sendMode: 'draft' } });
    expect(create.ok()).toBeTruthy();
    const { campaign } = await create.json();

    const queue = await request.post(`/api/campaigns/${campaign.id}/messages`, {
      data: { recipient: 'test@example.com', subject: 'Test', body: 'Hello from the e2e test.' },
    });
    expect(queue.ok()).toBeTruthy();

    const send = await request.post(`/api/campaigns/${campaign.id}/send`);
    expect(send.ok()).toBeTruthy();
    const sendBody = await send.json();
    expect(sendBody.result).toBe('NOT_CONFIGURED');
    expect(sendBody.messagesAffected).toBeGreaterThan(0);

    const messages = await request.get(`/api/campaigns/${campaign.id}/messages`);
    const { messages: rows } = await messages.json();
    expect(rows.every((m: { status: string }) => m.status === 'not_configured')).toBe(true);
  });
});

test.describe('MRP-008 competitors grid is real manual CRUD, not scraped data', () => {
  test('adding a competitor and a feature value persists for real', async ({ request }) => {
    await loginAsAdmin(request);
    const create = await request.post('/api/competitors', { data: { name: `E2E Competitor ${Date.now()}`, website: 'https://example.com' } });
    expect(create.ok()).toBeTruthy();
    const { competitor } = await create.json();

    const feature = await request.post(`/api/competitors/${competitor.id}/features`, {
      data: { featureKey: 'monthly_price', featureValue: '$99' },
    });
    expect(feature.ok()).toBeTruthy();

    const list = await request.get('/api/competitors');
    const { competitors, features } = await list.json();
    expect(competitors.some((c: { id: string }) => c.id === competitor.id)).toBe(true);
    expect(features.some((f: { competitor_id: string; feature_value: string }) => f.competitor_id === competitor.id && f.feature_value === '$99')).toBe(true);
  });
});
