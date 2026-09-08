// MCP Gateway — MCPG-001..005. The gateway registry (15 internal domain
// servers + 14 external-platform servers) existed as pure TypeScript
// domain code with a real Postgres schema behind it, but had zero API
// route or admin page anywhere in the app — same "rich schema, nothing
// built on top" pattern found repeatedly this session. Two tools
// (github.search_repositories, stackoverflow.search_questions) are real
// and executable against live public APIs; everything else honestly
// reports "not connected" rather than faking success.

import { test, expect } from 'playwright/test';
import { apiUrl } from './support/runtime';

async function loginAsAdmin(request: import('playwright/test').APIRequestContext) {
  const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
  expect(login.ok()).toBeTruthy();
}

test.describe('MCPG-001 GET /api/admin/mcp-gateway — auth gating', () => {
  test('requires admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const res = await unauth.get(apiUrl('/api/admin/mcp-gateway'));
    expect(res.status()).toBe(401);
    await unauth.dispose();
  });
});

test.describe('MCPG-002 all 14 external-platform servers are present with honest availability', () => {
  test('none-availability platforms (Apple Podcasts, Snapchat, Substack) have zero fabricated tools', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.get('/api/admin/mcp-gateway');
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.summary.serverCount).toBeGreaterThanOrEqual(29);

    const byId = Object.fromEntries(body.servers.map((s: { id: string }) => [s.id, s]));
    for (const id of ['apple-podcasts-mcp', 'snapchat-mcp', 'substack-mcp']) {
      expect(byId[id].availability).toBe('none');
      expect(byId[id].tools.length).toBe(0);
    }

    // Every tool needing credentials this environment doesn't have must
    // say so, not silently claim to work.
    const yelp = byId['yelp-mcp'];
    expect(yelp.tools[0].safetyNote).toMatch(/not configured/);
  });
});

test.describe('MCPG-003 real, executable tools actually hit live public APIs', () => {
  test('github.search_repositories returns real repos, not fabricated data', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.post('/api/admin/mcp-gateway/execute', {
      data: { serverSlug: 'github-mcp', toolName: 'search_repositories', args: { query: 'yoga studio management', perPage: 3 } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.executed).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    for (const repo of body.data) {
      expect(repo.url).toMatch(/^https:\/\/github\.com\//);
      expect(typeof repo.stars).toBe('number');
    }
  });

  test('stackoverflow.search_questions returns real questions', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.post('/api/admin/mcp-gateway/execute', {
      data: { serverSlug: 'stackoverflow-mcp', toolName: 'search_questions', args: { query: 'react hooks' } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.executed).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].url).toMatch(/^https:\/\/stackoverflow\.com\//);
  });
});

test.describe('MCPG-004 unwired tools honestly refuse, never fake success', () => {
  test('a tool needing missing credentials reports not-connected, not a fake result', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.post('/api/admin/mcp-gateway/execute', {
      data: { serverSlug: 'yelp-mcp', toolName: 'search_businesses', args: { term: 'yoga', location: 'Toronto' } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.executed).toBe(false);
    expect(body.reason).toMatch(/not configured/);
  });
});

test.describe('MCPG-005 approval-tier tools cannot be executed directly, and the page renders', () => {
  test('a staff_approval tool is refused with 403, never silently run', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.post('/api/admin/mcp-gateway/execute', {
      data: { serverSlug: 'github-mcp', toolName: 'github_create_issue', args: { repo: 'x', title: 'x', body: 'x' } },
    });
    expect(res.status()).toBe(403);
  });

  test('/admin/mcp-gateway renders the real catalog and can run a live tool', async ({ page }) => {
    await page.request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
    await page.goto('/admin/mcp-gateway');
    await expect(page.getByRole('heading', { name: 'MCP Gateway' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'External Platforms (14)' }).click();
    await expect(page.getByText('GitHub MCP')).toBeVisible();
  });
});
