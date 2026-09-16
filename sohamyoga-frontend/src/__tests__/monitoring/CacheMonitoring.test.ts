import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/cache/route';
import { requireAdmin } from '@/lib/admin-auth';

jest.mock('@/lib/admin-auth', () => ({ requireAdmin: jest.fn() }));
// next/cache may not be available in the test environment; mock it.
jest.mock('next/cache', () => ({ revalidateTag: jest.fn() }), { virtual: true });

const mockRequireAdmin = requireAdmin as jest.Mock;

function makeReq(url = 'https://portal.example/api/admin/cache', init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...originalEnv };
  delete process.env.REDIS_URL;
  // Default: admin passes
  mockRequireAdmin.mockResolvedValue(null);
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('GET /api/admin/cache', () => {
  it('returns 401 when admin auth fails', async () => {
    mockRequireAdmin.mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns redis_configured: false when REDIS_URL is not set', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json() as {
      redis_configured: boolean;
      redis_url_set: boolean;
      routes_with_no_store: number;
      routes_with_force_cache: number;
      nextjs_cache: string;
    };
    expect(body.redis_configured).toBe(false);
    expect(body.redis_url_set).toBe(false);
  });

  it('returns expected shape including cache route counts', async () => {
    const res = await GET(makeReq());
    const body = await res.json() as {
      redis_configured: boolean;
      redis_url_set: boolean;
      redis_latency_ms: number | null;
      nextjs_cache: string;
      routes_with_no_store: number;
      routes_with_force_cache: number;
    };
    expect(typeof body.routes_with_no_store).toBe('number');
    expect(typeof body.routes_with_force_cache).toBe('number');
    expect(body.routes_with_no_store).toBeGreaterThan(0);
    expect(body.routes_with_force_cache).toBe(0);
    expect(body.nextjs_cache).toBe('enabled');
  });
});

describe('POST /api/admin/cache', () => {
  it('returns 401 when admin auth fails', async () => {
    mockRequireAdmin.mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    const res = await POST(makeReq('https://portal.example/api/admin/cache', {
      method: 'POST',
      body: JSON.stringify({ action: 'clear_tag' }),
    }));
    expect(res.status).toBe(401);
  });

  it('returns cleared: false with reason when Redis not configured', async () => {
    const res = await POST(makeReq('https://portal.example/api/admin/cache', {
      method: 'POST',
      body: JSON.stringify({ action: 'clear_tag' }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { cleared: boolean; reason?: string };
    expect(body.cleared).toBe(false);
    expect(body.reason).toBe('Redis not configured');
  });

  it('returns 400 for unknown action', async () => {
    const res = await POST(makeReq('https://portal.example/api/admin/cache', {
      method: 'POST',
      body: JSON.stringify({ action: 'nuke_everything' }),
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await POST(makeReq('https://portal.example/api/admin/cache', {
      method: 'POST',
      body: 'not-json',
    }));
    expect(res.status).toBe(400);
  });
});
