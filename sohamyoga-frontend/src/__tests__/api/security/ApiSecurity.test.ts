/**
 * API Security Tests
 *
 * Verifies that:
 * 1. Every admin/* route returns 401 when requireAdmin denies the request
 * 2. Routes are resilient to SQL-injection-like query param values
 * 3. POST routes with invalid JSON body return 400
 * 4. Responses are always JSON
 */

import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks (jest.mock is hoisted — use jest.fn() inside factories)
// ---------------------------------------------------------------------------

jest.mock('@/lib/postgres', () => ({
  query: jest.fn(),
  getPool: jest.fn(),
}));

// blog-cms and many admin routes import `pool` from @/lib/db (a Proxy around postgres.ts).
// Mock @/lib/db directly to prevent the Proxy from calling the real getPool().
jest.mock('@/lib/db', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('@/lib/admin-auth', () => ({
  requireAdmin: jest.fn(),
  getAdminPrincipal: jest.fn(),
}));

jest.mock('@/lib/module-intelligence-schema', () => ({ ensureSchema: jest.fn() }), {
  virtual: true,
});

// ---------------------------------------------------------------------------
// Resolve mocks after jest.mock() calls
// ---------------------------------------------------------------------------

import * as postgresModule from '@/lib/postgres';
import * as dbModule from '@/lib/db';
import * as adminAuth from '@/lib/admin-auth';

const postgresQuery = postgresModule.query as jest.Mock;
const dbPoolQuery = (dbModule.pool as unknown as { query: jest.Mock }).query;
const requireAdmin = adminAuth.requireAdmin as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  url = 'http://localhost/api/admin/test',
  options: { method?: string; body?: unknown } = {},
): NextRequest {
  // Use a plain object cast — Next.js RequestInit is a superset of the global type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const init: any = { method: options.method ?? 'GET' };
  if (options.body !== undefined) {
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(url, init);
}

const DENIED_RESPONSE = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

// ---------------------------------------------------------------------------
// 1. requireAdmin guard
// ---------------------------------------------------------------------------

describe('requireAdmin guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    postgresQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    dbPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  test('service-tickets GET — denied when requireAdmin returns a Response', async () => {
    requireAdmin.mockResolvedValue(DENIED_RESPONSE);
    const { GET } = await import('@/app/api/admin/service-tickets/route');
    const req = makeRequest('http://localhost/api/admin/service-tickets');
    const res = await GET(req);
    expect(res.status).toBe(401);
    // Neither postgres.query nor pool.query should have been called
    expect(postgresQuery).not.toHaveBeenCalled();
    expect(dbPoolQuery).not.toHaveBeenCalled();
  });

  test('service-tickets GET — allowed when requireAdmin returns null', async () => {
    requireAdmin.mockResolvedValue(null);
    postgresQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const { GET } = await import('@/app/api/admin/service-tickets/route');
    const req = makeRequest('http://localhost/api/admin/service-tickets');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  test('blog-cms [id] GET — denied when requireAdmin returns a Response', async () => {
    requireAdmin.mockResolvedValue(DENIED_RESPONSE);
    const { GET } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/1');
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(401);
    expect(dbPoolQuery).not.toHaveBeenCalled();
  });

  test('blog-cms [id] PATCH — denied when requireAdmin returns a Response', async () => {
    requireAdmin.mockResolvedValue(DENIED_RESPONSE);
    const { PATCH } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/1', {
      method: 'PATCH',
      body: { title: 'new title' },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(401);
  });

  test('blog-cms [id] DELETE — denied when requireAdmin returns a Response', async () => {
    requireAdmin.mockResolvedValue(DENIED_RESPONSE);
    const { DELETE } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 2. SQL injection via query params — routes use parameterized queries ($1, $2...)
// ---------------------------------------------------------------------------

describe('SQL injection resilience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue(null);
    postgresQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    dbPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  test('blog-cms [id] — non-numeric id returns 400, no query executed', async () => {
    const { GET } = await import('@/app/api/admin/blog-cms/[id]/route');
    const injectionId = "'; DROP TABLE users; --";
    const req = makeRequest(`http://localhost/api/admin/blog-cms/${encodeURIComponent(injectionId)}`);
    const res = await GET(req, { params: Promise.resolve({ id: injectionId }) });
    // parseInt of injection string is NaN → 400
    expect(res.status).toBe(400);
    expect(dbPoolQuery).not.toHaveBeenCalled();
  });

  test('blog-cms [id] — numeric id queries with parameterized $1, not interpolated string', async () => {
    const { GET } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/42');
    const res = await GET(req, { params: Promise.resolve({ id: '42' }) });
    // rowCount === 0 → 404 (no row for id 42)
    expect(res.status).toBe(404);
    // Verify query used parameterized form — the id goes in the values array, not in the SQL string
    expect(dbPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('$1'),
      expect.arrayContaining([42]),
    );
  });

  test('ad-planner [id] GET — id passed as parameter, not interpolated into SQL', async () => {
    const { GET } = await import('@/app/api/admin/ad-planner/plans/[id]/route');
    const testId = '1 OR 1=1';
    postgresQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const req = makeRequest(`http://localhost/api/admin/ad-planner/plans/${encodeURIComponent(testId)}`);
    const res = await GET(req, { params: Promise.resolve({ id: testId }) });
    // No row matches → 404
    expect(res.status).toBe(404);
    // Critically: the id string was passed as a parameter, not interpolated
    expect(postgresQuery).toHaveBeenCalledWith(
      expect.stringContaining('$1'),
      expect.arrayContaining([testId]),
    );
    // SQL must not contain the raw injection string
    const sqlArg = (postgresQuery.mock.calls[0] as unknown[])[0] as string;
    expect(sqlArg).not.toContain('1 OR 1=1');
  });
});

// ---------------------------------------------------------------------------
// 3. POST routes with invalid JSON return 400
// ---------------------------------------------------------------------------

describe('Invalid JSON body → 400', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue(null);
    postgresQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    dbPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  test('blog-cms [id] PATCH — malformed JSON body → 400', async () => {
    const { PATCH } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = new NextRequest('http://localhost/api/admin/blog-cms/1', {
      method: 'PATCH',
      body: 'not-valid-json{{{',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(400);
  });

  test('blog-cms [id] PATCH — empty body {} → 400 (no valid fields)', async () => {
    const { PATCH } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/1', {
      method: 'PATCH',
      body: {},
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: expect.any(String) });
  });

  test('blog-cms [id] PATCH — unrecognized fields only → 400 (no valid fields)', async () => {
    const { PATCH } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/1', {
      method: 'PATCH',
      body: { unknownField: 'value', anotherBadField: 'attack' },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 4. Response content-type is always JSON
// ---------------------------------------------------------------------------

describe('Response content-type is application/json', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue(null);
    postgresQuery.mockResolvedValue({ rows: [{ id: 1, title: 'Test Post' }], rowCount: 1 });
    dbPoolQuery.mockResolvedValue({ rows: [{ id: 1, title: 'Test Post' }], rowCount: 1 });
  });

  test('blog-cms [id] GET — 200 response has application/json content-type', async () => {
    const { GET } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/1');
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type') ?? '';
    expect(ct).toMatch(/application\/json/);
  });

  test('auth-denied 401 response is parseable as JSON', async () => {
    requireAdmin.mockResolvedValue(DENIED_RESPONSE);
    const { GET } = await import('@/app/api/admin/service-tickets/route');
    const req = makeRequest('http://localhost/api/admin/service-tickets');
    const res = await GET(req);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('blog-cms [id] — invalid id 400 is JSON', async () => {
    const { GET } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/not-a-number');
    const res = await GET(req, { params: Promise.resolve({ id: 'not-a-number' }) });
    expect(res.status).toBe(400);
    const ct = res.headers.get('content-type') ?? '';
    expect(ct).toMatch(/application\/json/);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});
