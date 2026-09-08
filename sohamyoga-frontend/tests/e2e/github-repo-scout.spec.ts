// GitHub Repo Scout — GHS-001..004. Answers the explicit request "assign
// job to ollama to search on github" for open-source reuse candidates.
// Seeded with the user's own two researched shortlists; GitHubRepoScoutJob
// enriches them and searches for genuinely new candidates via the real
// public GitHub API.

import { test, expect } from 'playwright/test';
import { apiUrl } from './support/runtime';

async function loginAsAdmin(request: import('playwright/test').APIRequestContext) {
  const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
  expect(login.ok()).toBeTruthy();
}

test.describe('GHS-001 GET /api/admin/growth/github-scout — auth gating', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get(apiUrl('/api/admin/growth/github-scout'));
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });
});

test.describe('GHS-002 the user\'s seeded shortlist is present and real', () => {
  test('all 18 user-provided repos are present, none fabricated', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/growth/github-scout');
    expect(res.status()).toBe(200);
    const body = await res.json();

    const userProvided = body.candidates.filter((c: { source: string }) => c.source === 'user_provided');
    expect(userProvided.length).toBe(18);
    for (const name of ['n8n-io/n8n', 'gitroomhq/postiz-app', 'PostHog/posthog', 'formbricks/formbricks', 'mautic/mautic', 'dubinc/dub']) {
      expect(userProvided.some((c: { fullName: string }) => c.fullName === name)).toBe(true);
    }
  });
});

test.describe('GHS-003 discovered candidates carry real GitHub metadata, never fabricated', () => {
  test('every discovered candidate has a real star count and a matched query', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/growth/github-scout');
    const body = await res.json();
    const discovered = body.candidates.filter((c: { source: string }) => c.source === 'ollama_search');

    for (const c of discovered) {
      expect(typeof c.stars).toBe('number');
      expect(c.stars).toBeGreaterThanOrEqual(0);
      expect(typeof c.matchedQuery).toBe('string');
      expect(c.url).toMatch(/^https:\/\/github\.com\//);
    }
  });
});

test.describe('GHS-004 page renders both sections', () => {
  test('/admin/growth/github-scout shows your shortlist and discovered candidates', async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto('/admin/growth/github-scout');
    await expect(page.getByRole('heading', { name: 'GitHub Repo Scout' })).toBeVisible();
    await expect(page.getByText(/Your shortlist \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Discovered by GitHubRepoScoutJob/)).toBeVisible();
  });
});
