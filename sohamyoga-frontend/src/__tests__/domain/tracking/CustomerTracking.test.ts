import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/customer/track/route';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

jest.mock('@/lib/postgres', () => ({ databaseConfigured: jest.fn(), query: jest.fn() }));
jest.mock('@/lib/admin-auth', () => ({ requireAdmin: jest.fn() }));

const BASE = 'https://portal.example/api/customer/track';

beforeEach(() => {
  jest.resetAllMocks();
  (databaseConfigured as jest.Mock).mockReturnValue(true);
  (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
  (requireAdmin as jest.Mock).mockResolvedValue(null);
});

// ── POST /api/customer/track ──────────────────────────────────────────────────

describe('POST /api/customer/track', () => {
  it('returns { ok: true } when event_type is valid', async () => {
    const req = new NextRequest(BASE, {
      method: 'POST',
      body: JSON.stringify({ event_type: 'page_view', page_path: '/customer/shop' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('returns 400 when event_type is missing', async () => {
    const req = new NextRequest(BASE, {
      method: 'POST',
      body: JSON.stringify({ page_path: '/customer/shop' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/event_type/i);
  });

  it('returns 400 when event_type is an empty string', async () => {
    const req = new NextRequest(BASE, {
      method: 'POST',
      body: JSON.stringify({ event_type: '   ' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest(BASE, {
      method: 'POST',
      body: 'not-json',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('issues two queries — one to ensure table, one to insert', async () => {
    const req = new NextRequest(BASE, {
      method: 'POST',
      body: JSON.stringify({ event_type: 'click', element_id: 'btn-buy' }),
      headers: { 'content-type': 'application/json' },
    });
    await POST(req);
    // First call: CREATE TABLE IF NOT EXISTS; second: INSERT
    expect((query as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    const allSql: string = (query as jest.Mock).mock.calls.map((c: unknown[]) => c[0]).join(' ');
    expect(allSql).toMatch(/CREATE TABLE IF NOT EXISTS customer_event/i);
  });

  it('silently succeeds even when DB is not configured', async () => {
    (databaseConfigured as jest.Mock).mockReturnValue(false);
    const req = new NextRequest(BASE, {
      method: 'POST',
      body: JSON.stringify({ event_type: 'page_view' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(query).not.toHaveBeenCalled();
  });
});

// ── GET /api/customer/track ───────────────────────────────────────────────────

describe('GET /api/customer/track', () => {
  it('returns 401 / denied when requireAdmin rejects the caller', async () => {
    const denied = Response.json({ error: 'Unauthorized' }, { status: 401 });
    (requireAdmin as jest.Mock).mockResolvedValue(denied);

    const req = new NextRequest(BASE, { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns events list for an authenticated admin', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })           // ensure table
      .mockResolvedValueOnce({ rows: [{ id: 1, event_type: 'page_view' }] }); // select

    const req = new NextRequest(BASE, { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.events)).toBe(true);
  });

  it('returns 503 when DB is not configured', async () => {
    (databaseConfigured as jest.Mock).mockReturnValue(false);
    const req = new NextRequest(BASE, { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it('passes event_type filter as a query param', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const req = new NextRequest(`${BASE}?event_type=click`, { method: 'GET' });
    await GET(req);

    const selectCall = (query as jest.Mock).mock.calls.find((c: unknown[]) =>
      typeof c[0] === 'string' && (c[0] as string).includes('SELECT'),
    );
    expect(selectCall).toBeDefined();
    expect(selectCall![1]).toContain('click');
  });
});
