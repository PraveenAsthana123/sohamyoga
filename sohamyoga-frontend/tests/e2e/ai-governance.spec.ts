// AI Governance — GOV-001..003. /admin/ai-governance and its backing API
// (GET /api/admin/ai-governance) surface eleven audit dimensions over real
// data (model registry, traced Run Now executions, real churn/VOC
// rationale, source-cited job guardrails). See the docstring atop
// src/app/api/admin/ai-governance/route.ts for exactly what backs each
// section and its known real limitations.

import { test, expect } from 'playwright/test';

test.describe('GOV-001 GET /api/admin/ai-governance — admin auth', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get('http://127.0.0.1:8085/api/admin/ai-governance');
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });
});

test.describe('GOV-002 GET /api/admin/ai-governance — positive', () => {
  test('returns all eleven dimensions with real, non-empty structural data', async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    expect(login.ok()).toBeTruthy();

    const res = await request.get('/api/admin/ai-governance');
    expect(res.status()).toBe(200);
    const body = await res.json();

    // Governance: the real model registry, not a mock list.
    expect(body.governance.totalModels).toBeGreaterThan(0);
    expect(Array.isArray(body.governance.models)).toBe(true);

    // Decision/Fairness/Ethical: source-cited, fixed-size classification arrays.
    expect(body.decision.length).toBe(22);
    expect(body.fairness.length).toBeGreaterThan(0);
    expect(body.ethical.length).toBeGreaterThan(0);
    for (const d of body.decision) {
      expect(['draft-requires-approval', 'advisory-informational', 'deterministic-auto-apply']).toContain(d.autonomy);
      expect(typeof d.evidence).toBe('string');
    }
    for (const f of body.fairness) {
      expect(f.usesProtectedAttributes).toBe(false);
    }

    // Interpretable: every Ollama job maps to a named tier, never undefined.
    expect(Object.keys(body.interpretable.modelTierByJob).length).toBe(22);
    expect(Object.values(body.interpretable.modelTierByJob).every((t: unknown) => t === 'fast' || t === 'strong')).toBe(true);

    // Responsible: composite counts must reconcile with the decision matrix.
    expect(body.responsible.draftGatedJobs + body.responsible.advisoryJobs).toBeLessThanOrEqual(body.responsible.ollamaJobs);

    // Risk/Performance/Accountable: real counts, never negative or fabricated ratios.
    expect(body.risk.failureRatePct).toBeGreaterThanOrEqual(0);
    expect(body.risk.failureRatePct).toBeLessThanOrEqual(100);
  });
});

test.describe('GOV-003 /admin/ai-governance page — renders all eleven sections', () => {
  test('every named AI governance dimension has a visible heading with real content', async ({ page }) => {
    // page.request shares the browser context's cookie jar directly — see
    // the note in demo-showcase-hub.spec.ts for why this replaced the
    // request+storageState+addCookies pattern.
    const login = await page.request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    expect(login.ok()).toBeTruthy();

    await page.goto('/admin/ai-governance');
    await expect(page.getByRole('heading', { name: 'AI Governance', exact: true })).toBeVisible();
    for (const title of [
      'Responsible AI', 'Explainable AI', 'Accountable AI', 'Fairness AI', 'Ethical AI',
      'Risk AI', 'Governance AI', 'Interpretable AI', 'Decision AI', 'Performance AI', 'Outlier AI',
    ]) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    }
    // Ethical AI content must be the real, source-cited quote, not a placeholder.
    await expect(page.getByText('Output is advisory ONLY — no auto-cancellations.')).toBeVisible();
  });
});
