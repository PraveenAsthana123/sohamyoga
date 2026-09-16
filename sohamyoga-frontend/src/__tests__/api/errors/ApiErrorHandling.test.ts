/**
 * API Error Handling Tests
 *
 * Verifies that:
 * 1. When a DB query throws, the route returns 500 with a safe error message (no stack trace)
 * 2. Error responses never expose raw stack traces or internal server details
 * 3. All routes return JSON (application/json), never plain text
 * 4. 404 is returned when records are not found
 */

import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/postgres', () => ({
  query: jest.fn(),
  getPool: jest.fn(),
}));

// blog-cms and many admin routes import `pool` from @/lib/db (a Proxy around postgres.ts).
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
// Resolve mocks
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

// A realistic-looking DB error that includes a stack trace referencing internal paths
const DB_ERROR = Object.assign(new Error('connection refused'), {
  stack:
    'Error: connection refused\n' +
    '    at Pool.connect (/mnt/deepa/sohamyoga/node_modules/pg/lib/pool.js:42:11)',
  code: 'ECONNREFUSED',
});

// ---------------------------------------------------------------------------
// 1. Query failure → 500 with safe message
// ---------------------------------------------------------------------------

describe('DB query failure → safe 500', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue(null); // allow all requests through
  });

  test('service-tickets GET — query throws → 500 with safe message', async () => {
    postgresQuery.mockRejectedValue(DB_ERROR);
    const { GET } = await import('@/app/api/admin/service-tickets/route');
    const req = makeRequest('http://localhost/api/admin/service-tickets');
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    // Must NOT expose raw stack trace
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('at Pool.connect');
    expect(bodyStr).not.toContain('node_modules');
  });

  test('blog-cms [id] GET — query throws Error → 500 with err.message (not stack)', async () => {
    dbPoolQuery.mockRejectedValue(new Error('SSL SYSCALL EOF detected'));
    const { GET } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/1');
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    // err instanceof Error → uses err.message, not the full stack string
    expect(body.error).toBe('SSL SYSCALL EOF detected');
  });

  test('blog-cms [id] GET — query throws non-Error string → 500 with generic message', async () => {
    // pg driver occasionally throws a plain string or object on fatal errors
    dbPoolQuery.mockRejectedValue('FATAL: database does not exist');
    const { GET } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/1');
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    // non-Error → must fall back to generic string, never expose the raw thrown value
    expect(body.error).toBe('Internal server error');
  });

  test('blog-cms [id] PATCH — query throws → 500, body contains no stack frames', async () => {
    dbPoolQuery.mockRejectedValue(DB_ERROR);
    const { PATCH } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/1', {
      method: 'PATCH',
      body: { title: 'New Title' },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(500);
    const bodyStr = JSON.stringify(await res.json());
    expect(bodyStr).not.toContain('node_modules');
    expect(bodyStr).not.toContain('at Pool.connect');
  });
});

// ---------------------------------------------------------------------------
// 2. Error responses are always JSON with correct content-type
// ---------------------------------------------------------------------------

describe('Error responses are always JSON', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue(null);
    postgresQuery.mockRejectedValue(new Error('DB down'));
    dbPoolQuery.mockRejectedValue(new Error('DB down'));
  });

  test('service-tickets GET — 500 response has application/json content-type', async () => {
    const { GET } = await import('@/app/api/admin/service-tickets/route');
    const req = makeRequest('http://localhost/api/admin/service-tickets');
    const res = await GET(req);
    expect(res.status).toBe(500);
    const ct = res.headers.get('content-type') ?? '';
    expect(ct).toMatch(/application\/json/);
    await expect(res.json()).resolves.toHaveProperty('error');
  });

  test('blog-cms [id] GET — 404 response has application/json content-type', async () => {
    dbPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const { GET } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/99999');
    const res = await GET(req, { params: Promise.resolve({ id: '99999' }) });
    expect(res.status).toBe(404);
    const ct = res.headers.get('content-type') ?? '';
    expect(ct).toMatch(/application\/json/);
    await expect(res.json()).resolves.toHaveProperty('error');
  });

  test('blog-cms [id] — invalid id 400 response is JSON', async () => {
    dbPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const { GET } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/abc');
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(400);
    const ct = res.headers.get('content-type') ?? '';
    expect(ct).toMatch(/application\/json/);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// 3. Error response never exposes internal details (stack trace, file paths, secrets)
// ---------------------------------------------------------------------------

describe('No stack trace / internal detail exposure in error bodies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue(null);
  });

  const dangerousPatterns = [
    /at\s+\w[\w.]*\s+\(/, // stack frame lines like "at Pool.connect (..."
    /node_modules/,
    /\/mnt\//,
    /\/home\//,
    /ECONNREFUSED/,
  ];

  test('blog-cms GET — 500 body has no dangerous internal patterns', async () => {
    dbPoolQuery.mockRejectedValue(
      Object.assign(new Error('connection refused'), {
        stack:
          'Error: connection refused\n' +
          '    at Connection.parseE (/mnt/deepa/sohamyoga/node_modules/pg/lib/connection.js:612:11)',
      }),
    );
    const { GET } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/1');
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) });
    const bodyStr = JSON.stringify(await res.json());

    for (const pattern of dangerousPatterns) {
      expect(bodyStr).not.toMatch(pattern);
    }
  });

  test('service-tickets GET — DB error body has no stack trace patterns', async () => {
    postgresQuery.mockRejectedValue(DB_ERROR);
    const { GET } = await import('@/app/api/admin/service-tickets/route');
    const req = makeRequest('http://localhost/api/admin/service-tickets');
    const res = await GET(req);
    const bodyStr = JSON.stringify(await res.json());

    for (const pattern of dangerousPatterns) {
      expect(bodyStr).not.toMatch(pattern);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. 404 for unknown / missing records
// ---------------------------------------------------------------------------

describe('404 for missing records', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue(null);
    dbPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    postgresQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  test('blog-cms [id] GET — no row in DB → 404 with error field', async () => {
    const { GET } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/99999');
    const res = await GET(req, { params: Promise.resolve({ id: '99999' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  test('blog-cms [id] DELETE — no row in DB → 404 with error field', async () => {
    const { DELETE } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/99999', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: '99999' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('blog-cms [id] PATCH — no row updated → 404', async () => {
    dbPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const { PATCH } = await import('@/app/api/admin/blog-cms/[id]/route');
    const req = makeRequest('http://localhost/api/admin/blog-cms/99999', {
      method: 'PATCH',
      body: { title: 'Updated title' },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: '99999' }) });
    expect(res.status).toBe(404);
  });
});
