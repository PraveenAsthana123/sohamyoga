import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '@/app/api/admin/popups/route';
import { GET as getActive } from '@/app/api/popups/active/route';
import { requireAdmin } from '@/lib/admin-auth';

// The popups admin route uses @/lib/db (pool), not @/lib/postgres
jest.mock('@/lib/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));
jest.mock('@/lib/admin-auth', () => ({ requireAdmin: jest.fn() }));

import { pool } from '@/lib/db';
const mockQuery = pool.query as jest.Mock;

const ADMIN_BASE  = 'https://portal.example/api/admin/popups';
const PUBLIC_BASE = 'https://portal.example/api/popups/active';

beforeEach(() => {
  jest.resetAllMocks();
  (requireAdmin as jest.Mock).mockResolvedValue(null);
  // Default: resolve with empty rows for every call
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

// ── GET /api/admin/popups ─────────────────────────────────────────────────────

describe('GET /api/admin/popups', () => {
  it('returns 401 when caller is not admin', async () => {
    const denied = Response.json({ error: 'Unauthorized' }, { status: 401 });
    (requireAdmin as jest.Mock).mockResolvedValue(denied);

    const req = new NextRequest(ADMIN_BASE, { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns popups array for authenticated admin', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })  // ensure table
      .mockResolvedValueOnce({              // select
        rows: [{
          id: 1, name: 'Exit Intent', type: 'modal', status: 'active',
          trigger_type: 'exit_intent', trigger_value: null, target_pages: [],
          headline: 'Wait!', body_text: null, cta_text: 'Stay', cta_url: '/offers',
          background_color: '#6366f1', text_color: '#ffffff',
          show_once: true, show_after_close_days: 7,
          impressions: 200, clicks: 20, closes: 10,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }],
      });

    const req = new NextRequest(ADMIN_BASE, { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.popups)).toBe(true);
    expect(body.popups[0].name).toBe('Exit Intent');
  });

  it('attaches computed CTR to each popup', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 2, name: 'Timer Popup', type: 'modal', status: 'active',
          trigger_type: 'timer', trigger_value: '5000', target_pages: [],
          headline: 'Special Offer', body_text: null, cta_text: 'Claim', cta_url: '/promo',
          background_color: '#6366f1', text_color: '#ffffff',
          show_once: true, show_after_close_days: 7,
          impressions: 100, clicks: 10, closes: 5,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }],
      });

    const req = new NextRequest(ADMIN_BASE, { method: 'GET' });
    const res = await GET(req);
    const body = await res.json();
    // CTR = 10/100 * 100 = 10.0
    expect(body.popups[0].ctr).toBe(10);
  });
});

// ── POST /api/admin/popups ────────────────────────────────────────────────────

describe('POST /api/admin/popups', () => {
  it('creates a popup with required fields and returns 201', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })             // ensure table
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }); // insert

    const req = new NextRequest(ADMIN_BASE, {
      method: 'POST',
      body: JSON.stringify({ name: 'Summer Promo Popup', trigger_type: 'timer' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.id).toBe(99);
  });

  it('returns 400 when name is missing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = new NextRequest(ADMIN_BASE, {
      method: 'POST',
      body: JSON.stringify({ trigger_type: 'exit_intent' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/name/i);
  });

  it('returns 400 when name is an empty string', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = new NextRequest(ADMIN_BASE, {
      method: 'POST',
      body: JSON.stringify({ name: '   ' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when caller is not admin', async () => {
    const denied = Response.json({ error: 'Unauthorized' }, { status: 401 });
    (requireAdmin as jest.Mock).mockResolvedValue(denied);

    const req = new NextRequest(ADMIN_BASE, {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Popup' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/admin/popups ──────────────────────────────────────────────────

describe('DELETE /api/admin/popups', () => {
  it('deletes an existing popup and returns { ok: true }', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })             // ensure table
      .mockResolvedValueOnce({ rows: [{ id: 5 }] }); // delete returning

    const req = new NextRequest(ADMIN_BASE, {
      method: 'DELETE',
      body: JSON.stringify({ id: 5 }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await DELETE(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('returns 401 when caller is not admin', async () => {
    const denied = Response.json({ error: 'Unauthorized' }, { status: 401 });
    (requireAdmin as jest.Mock).mockResolvedValue(denied);

    const req = new NextRequest(ADMIN_BASE, {
      method: 'DELETE',
      body: JSON.stringify({ id: 5 }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns 404 when popup id does not exist', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })  // ensure table
      .mockResolvedValueOnce({ rows: [] }); // delete returning (no match)

    const req = new NextRequest(ADMIN_BASE, {
      method: 'DELETE',
      body: JSON.stringify({ id: 9999 }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });
});

// ── GET /api/popups/active — public endpoint ──────────────────────────────────

describe('GET /api/popups/active (public)', () => {
  it('returns active popups without requiring auth', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 3, name: 'Active Popup', type: 'modal', trigger_type: 'timer',
        trigger_value: '3000', target_pages: ['/'], headline: 'Hello', body_text: null,
        cta_text: 'Go', cta_url: '/promo', background_color: '#6366f1', text_color: '#fff',
        show_once: true, show_after_close_days: 7,
      }],
    });

    const req = new NextRequest(PUBLIC_BASE, { method: 'GET' });
    const res = await getActive(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.popups)).toBe(true);
    expect(body.popups[0].name).toBe('Active Popup');
    // requireAdmin should never be called for the public endpoint
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it('returns an empty array gracefully when the table does not exist yet', async () => {
    mockQuery.mockRejectedValueOnce(new Error('relation "popup_cta" does not exist'));

    const req = new NextRequest(PUBLIC_BASE, { method: 'GET' });
    const res = await getActive(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.popups).toEqual([]);
  });
});
