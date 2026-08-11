// Social Campaign Scheduler — SOC-001..005. Before this, the MCP social
// gateway (/api/mcp/social) called Postiz endpoints that never existed
// (verified directly against the running container's compiled source —
// wrong port, wrong auth header, wrong paths), create_content_draft never
// created the social_platform_variant rows schedule_post/publish_post
// depend on, and the approval workflow could create a pending request but
// nothing anywhere could ever approve one. All three are real, fixed here.
//
// A real Postiz account + API key now exist (the Temporal blocker that
// prevented registration is fixed — see integrations/postiz/docker-
// compose.yml), so requests now genuinely reach Postiz. Full publish still
// correctly fails: zero social accounts are connected through Postiz's own
// OAuth flow, which needs real platform app credentials and a human
// completing the consent screen. SOC-004 asserts that failure is the
// CORRECT, honest one, not evidence the feature doesn't work.

import { test, expect } from 'playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

const TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';
const PREFIX = 'e2e-social-scheduler-';

test.afterAll(async () => {
  await pool.query(`DELETE FROM social_mcp_approval_log WHERE draft_id IN (SELECT id FROM social_content_draft WHERE master_text LIKE $1)`, [`${PREFIX}%`]);
  await pool.query(`DELETE FROM social_platform_variant WHERE draft_id IN (SELECT id FROM social_content_draft WHERE master_text LIKE $1)`, [`${PREFIX}%`]);
  await pool.query(`DELETE FROM social_content_draft WHERE master_text LIKE $1`, [`${PREFIX}%`]);
  await pool.query(`DELETE FROM social_account WHERE account_name LIKE $1`, [`${PREFIX}%`]);
  await pool.end();
});

async function loginAsAdmin(request: import('playwright/test').APIRequestContext) {
  const login = await request.post('/api/auth/login', { data: { email: 'admin_demo@sohamyoga.ca', password: 'AdminDemo@123456' } });
  expect(login.ok()).toBeTruthy();
}

async function callMcp(request: import('playwright/test').APIRequestContext, tool: string, input: Record<string, unknown>) {
  const res = await request.post('/api/mcp/social', { data: { tool, input } });
  return { status: res.status(), body: await res.json() };
}

test.describe('SOC-001 create_content_draft — real platform variants', () => {
  test('creates a draft and reports unmatched platforms honestly when no account is connected', async ({ request }) => {
    await loginAsAdmin(request);
    const masterText = `${PREFIX}unmatched ${Date.now()}`;

    const { status, body } = await callMcp(request, 'create_content_draft', {
      tenantId: TENANT_ID, workspaceId: TENANT_ID, masterText, contentType: 'text',
      platforms: ['facebook', 'youtube'], generatedWithAI: false, tags: [],
    });
    expect(status).toBe(200);
    expect(body.result.unmatchedPlatforms.sort()).toEqual(['facebook', 'youtube']);

    const variants = await pool.query(`SELECT platform FROM social_platform_variant WHERE draft_id = $1`, [body.result.draftId]);
    expect(variants.rowCount).toBe(0); // no connected account for either platform — no variant rows, not fabricated ones
  });

  test('matches a real connected account and creates its platform_variant row', async ({ request }) => {
    await loginAsAdmin(request);
    const account = await pool.query(
      `INSERT INTO social_account (tenant_id, workspace_id, platform, account_name, platform_account_id, access_token_ref, status, postiz_account_id, connected_by)
       VALUES ($1, $1, 'facebook', $2, 'fixture-page-id', 'vault-ref-fixture', 'connected', 'fixture-postiz-id', '93fb63ba-8268-4816-b2bb-63994642e7b6') RETURNING id`,
      [TENANT_ID, `${PREFIX}fb-account`],
    );
    const masterText = `${PREFIX}matched ${Date.now()}`;

    const { status, body } = await callMcp(request, 'create_content_draft', {
      tenantId: TENANT_ID, workspaceId: TENANT_ID, masterText, contentType: 'text',
      platforms: ['facebook'], generatedWithAI: false, tags: [],
    });
    expect(status).toBe(200);
    expect(body.result.unmatchedPlatforms).toEqual([]);

    const variant = await pool.query(`SELECT account_id FROM social_platform_variant WHERE draft_id = $1`, [body.result.draftId]);
    expect(variant.rows[0].account_id).toBe(account.rows[0].id);
  });
});

test.describe('SOC-002 approval workflow — the previously-missing approve step', () => {
  test('request_approval creates a pending row, then PATCH approve mints a usable token', async ({ request }) => {
    await loginAsAdmin(request);
    const masterText = `${PREFIX}approval-flow ${Date.now()}`;
    const draft = await callMcp(request, 'create_content_draft', {
      tenantId: TENANT_ID, workspaceId: TENANT_ID, masterText, contentType: 'text',
      platforms: ['linkedin'], generatedWithAI: false, tags: [],
    });
    const draftId = draft.body.result.draftId;

    const requested = await callMcp(request, 'request_approval', { draftId, note: 'SOC-002' });
    expect(requested.status).toBe(200);
    const approvalId = requested.body.result.approvalRequestId;

    const pendingRow = await pool.query(`SELECT status, approval_token FROM social_mcp_approval_log WHERE id = $1`, [approvalId]);
    expect(pendingRow.rows[0]).toMatchObject({ status: 'pending', approval_token: null });

    const decide = await request.patch(`/api/admin/social/approvals/${approvalId}`, { data: { decision: 'approved' } });
    expect(decide.status()).toBe(200);
    const decideBody = await decide.json();
    expect(decideBody.approval.status).toBe('approved');
    expect(typeof decideBody.approval.approval_token).toBe('string');
    expect(decideBody.approval.approval_token.length).toBeGreaterThan(10);

    // Approving twice is rejected — status is no longer 'pending'.
    const second = await request.patch(`/api/admin/social/approvals/${approvalId}`, { data: { decision: 'approved' } });
    expect(second.status()).toBe(404);
  });

  test('an invalid decision value is rejected with 400', async ({ request }) => {
    await loginAsAdmin(request);
    const res = await request.patch('/api/admin/social/approvals/00000000-0000-0000-0000-000000000000', { data: { decision: 'maybe' } });
    expect(res.status()).toBe(400);
  });
});

test.describe('SOC-003 GET endpoints — auth gating', () => {
  test('drafts and approvals listing require admin auth', async ({ playwright }) => {
    const unauth = await playwright.request.newContext();
    const draftsRes = await unauth.get('http://127.0.0.1:8085/api/admin/social/drafts');
    expect(draftsRes.status()).toBe(401);
    const approvalsRes = await unauth.get('http://127.0.0.1:8085/api/admin/social/approvals');
    expect(approvalsRes.status()).toBe(401);
    await unauth.dispose();
  });
});

test.describe('SOC-004 publish_post — honest blocker, not a broken call', () => {
  test('an approved publish with no connected account fails with the real blocker message, not a 404', async ({ request }) => {
    await loginAsAdmin(request);
    const masterText = `${PREFIX}blocked-publish ${Date.now()}`;
    const draft = await callMcp(request, 'create_content_draft', {
      tenantId: TENANT_ID, workspaceId: TENANT_ID, masterText, contentType: 'text',
      platforms: ['x_twitter'], generatedWithAI: false, tags: [],
    });
    const draftId = draft.body.result.draftId;

    const requested = await callMcp(request, 'request_approval', { draftId });
    const approved = await request.patch(`/api/admin/social/approvals/${requested.body.result.approvalRequestId}`, { data: { decision: 'approved' } });
    const { approval_token } = (await approved.json()).approval;

    const publish = await callMcp(request, 'publish_post', { draftId, confirmApprovalId: approval_token });
    expect(publish.status).toBe(500);
    expect(publish.body.error).toContain('No connected social account for draft');
  });
});

test.describe('SOC-005 scheduler UI', () => {
  test('renders the drafts/approvals/new-draft sections', async ({ page }) => {
    await loginAsAdmin(page.request);
    await page.goto('/admin/social/scheduler');
    await expect(page.getByRole('heading', { name: 'Social Campaign Scheduler' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Draft' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Pending Approvals/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Drafts/ })).toBeVisible();
  });
});
