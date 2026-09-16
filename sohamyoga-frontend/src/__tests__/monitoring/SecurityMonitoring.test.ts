import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/monitoring/security/route';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

jest.mock('@/lib/admin-auth', () => ({ requireAdmin: jest.fn() }));
jest.mock('@/lib/db', () => ({
  pool: { connect: jest.fn() },
}));

const mockRequireAdmin = requireAdmin as jest.Mock;
// pool is replaced by the jest.mock factory above; cast via unknown to avoid overlap error.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPool = pool as unknown as { connect: jest.Mock };

function makeReq() {
  return new NextRequest('https://portal.example/api/admin/monitoring/security');
}

// Minimal mock client factory
function makeClient(queryResults: Array<{ rows: Record<string, string>[] }> = []) {
  let callIdx = 0;
  const client = {
    query: jest.fn().mockImplementation(() => {
      const result = queryResults[callIdx] ?? { rows: [{ count: '0' }] };
      callIdx++;
      return Promise.resolve(result);
    }),
    release: jest.fn(),
  };
  return client;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockRequireAdmin.mockResolvedValue(null); // admin passes
});

describe('GET /api/admin/monitoring/security', () => {
  it('returns 401 when admin auth fails', async () => {
    mockRequireAdmin.mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns expected shape with all required fields', async () => {
    const client = makeClient([
      { rows: [{ count: '5' }] },   // unauthorized_count (401s)
      { rows: [{ count: '2' }] },   // flagged_ai_calls
      { rows: [{ count: '3' }] },   // failed_logins
      { rows: [{ ip_address: '1.2.3.4', count: '15' }] }, // suspicious_ips
    ]);
    mockPool.connect.mockResolvedValue(client);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);

    const body = await res.json() as {
      unauthorized_count: number;
      flagged_ai_calls: number;
      failed_logins: number;
      suspicious_ips: { ip: string; count: number }[];
      generated_at: string;
    };

    expect(typeof body.unauthorized_count).toBe('number');
    expect(typeof body.flagged_ai_calls).toBe('number');
    expect(typeof body.failed_logins).toBe('number');
    expect(Array.isArray(body.suspicious_ips)).toBe(true);
    expect(typeof body.generated_at).toBe('string');
  });

  it('maps suspicious_ips rows to { ip, count } objects', async () => {
    const client = makeClient([
      { rows: [{ count: '10' }] },
      { rows: [{ count: '1' }] },
      { rows: [{ count: '4' }] },
      {
        rows: [
          { ip_address: '10.0.0.1', count: '20' },
          { ip_address: '192.168.1.5', count: '12' },
        ],
      },
    ]);
    mockPool.connect.mockResolvedValue(client);

    const res = await GET(makeReq());
    const body = await res.json() as { suspicious_ips: { ip: string; count: number }[] };

    expect(body.suspicious_ips).toHaveLength(2);
    expect(body.suspicious_ips[0]).toMatchObject({ ip: '10.0.0.1', count: 20 });
    expect(body.suspicious_ips[1]).toMatchObject({ ip: '192.168.1.5', count: 12 });
  });

  it('falls back gracefully when tables do not exist (query throws)', async () => {
    const client = {
      query: jest.fn().mockRejectedValue(new Error('relation does not exist')),
      release: jest.fn(),
    };
    mockPool.connect.mockResolvedValue(client);

    const res = await GET(makeReq());
    // Should still return 200 with zeroed counts via .catch() fallbacks in the route
    expect(res.status).toBe(200);
    const body = await res.json() as {
      unauthorized_count: number;
      flagged_ai_calls: number;
      failed_logins: number;
      suspicious_ips: unknown[];
    };
    expect(body.unauthorized_count).toBe(0);
    expect(body.flagged_ai_calls).toBe(0);
    expect(body.failed_logins).toBe(0);
    expect(body.suspicious_ips).toEqual([]);
  });

  it('returns zero counts when tables are empty', async () => {
    const client = makeClient([
      { rows: [{ count: '0' }] },
      { rows: [{ count: '0' }] },
      { rows: [{ count: '0' }] },
      { rows: [] },
    ]);
    mockPool.connect.mockResolvedValue(client);

    const res = await GET(makeReq());
    const body = await res.json() as {
      unauthorized_count: number;
      flagged_ai_calls: number;
      failed_logins: number;
      suspicious_ips: unknown[];
    };
    expect(body.unauthorized_count).toBe(0);
    expect(body.flagged_ai_calls).toBe(0);
    expect(body.failed_logins).toBe(0);
    expect(body.suspicious_ips).toEqual([]);
  });
});
