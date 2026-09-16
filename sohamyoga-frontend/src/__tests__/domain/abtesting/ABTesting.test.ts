import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/ab-tests/route';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

jest.mock('@/lib/postgres', () => ({ databaseConfigured: jest.fn(), query: jest.fn() }));
jest.mock('@/lib/admin-auth', () => ({ requireAdmin: jest.fn() }));

const BASE = 'https://portal.example/api/admin/ab-tests';

beforeEach(() => {
  jest.resetAllMocks();
  (databaseConfigured as jest.Mock).mockReturnValue(true);
  // Default: table ensure + real query both resolve cleanly
  (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
  (requireAdmin as jest.Mock).mockResolvedValue(null);
});

// ── GET /api/admin/ab-tests ───────────────────────────────────────────────────

describe('GET /api/admin/ab-tests', () => {
  it('returns 401 when caller is not an admin', async () => {
    const denied = Response.json({ error: 'Unauthorized' }, { status: 401 });
    (requireAdmin as jest.Mock).mockResolvedValue(denied);

    const req = new NextRequest(BASE, { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns tests array for authenticated admin', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] }) // ensure table
      .mockResolvedValueOnce({             // select
        rows: [{
          id: 1, name: 'Hero Button Test', status: 'running',
          variant_a_views: 100, variant_a_conversions: 10,
          variant_b_views: 100, variant_b_conversions: 15,
          winner: null, created_at: new Date().toISOString(),
        }],
      });

    const req = new NextRequest(BASE, { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.tests)).toBe(true);
    expect(body.tests[0].name).toBe('Hero Button Test');
  });

  it('returns 503 when DB is not configured', async () => {
    (databaseConfigured as jest.Mock).mockReturnValue(false);
    const req = new NextRequest(BASE, { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(503);
  });
});

// ── POST /api/admin/ab-tests ──────────────────────────────────────────────────

describe('POST /api/admin/ab-tests', () => {
  it('creates a test with valid required fields and returns 201', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })             // ensure table
      .mockResolvedValueOnce({ rows: [{ id: 42 }] }); // insert

    const req = new NextRequest(BASE, {
      method: 'POST',
      body: JSON.stringify({ name: 'Checkout CTA Test', traffic_split: 50 }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.id).toBe(42);
  });

  it('returns 400 when name is missing', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // ensure table

    const req = new NextRequest(BASE, {
      method: 'POST',
      body: JSON.stringify({ traffic_split: 50 }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/name/i);
  });

  it('returns 400 when name is an empty string', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const req = new NextRequest(BASE, {
      method: 'POST',
      body: JSON.stringify({ name: '   ' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when traffic_split is out of range', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const req = new NextRequest(BASE, {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', traffic_split: 100 }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when caller is not admin', async () => {
    const denied = Response.json({ error: 'Unauthorized' }, { status: 401 });
    (requireAdmin as jest.Mock).mockResolvedValue(denied);

    const req = new NextRequest(BASE, {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', traffic_split: 50 }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

// ── CVR / lift computation (unit-level) ──────────────────────────────────────

describe('CVR and lift computation via GET response', () => {
  function makeRow(aViews: number, aConv: number, bViews: number, bConv: number) {
    return {
      id: 1, name: 'Test', status: 'running',
      variant_a_views: aViews, variant_a_conversions: aConv,
      variant_b_views: bViews, variant_b_conversions: bConv,
      winner: null, created_at: new Date().toISOString(),
    };
  }

  it('computes CVR as conversions / views for each variant', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeRow(200, 20, 200, 30)] });

    const res = await GET(new NextRequest(BASE));
    const { tests } = await res.json() as { tests: Array<{ cvr_a: number; cvr_b: number }> };

    expect(tests[0].cvr_a).toBeCloseTo(0.1, 5);   // 20/200
    expect(tests[0].cvr_b).toBeCloseTo(0.15, 5);  // 30/200
  });

  it('returns cvr_a = 0 when variant A has zero views', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeRow(0, 0, 100, 10)] });

    const res = await GET(new NextRequest(BASE));
    const { tests } = await res.json() as { tests: Array<{ cvr_a: number }> };
    expect(tests[0].cvr_a).toBe(0);
  });

  it('computes lift_pct as |cvrA - cvrB| / max(cvrA, cvrB) * 100', async () => {
    // cvrA = 0.1, cvrB = 0.15 → lift = (0.15 - 0.1) / 0.15 * 100 ≈ 33.3
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeRow(200, 20, 200, 30)] });

    const res = await GET(new NextRequest(BASE));
    const { tests } = await res.json() as { tests: Array<{ lift_pct: number }> };
    expect(tests[0].lift_pct).toBeCloseTo(33.3, 0);
  });

  it('returns lift_pct = 0 when both variants have zero views', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeRow(0, 0, 0, 0)] });

    const res = await GET(new NextRequest(BASE));
    const { tests } = await res.json() as { tests: Array<{ lift_pct: number }> };
    expect(tests[0].lift_pct).toBe(0);
  });
});
