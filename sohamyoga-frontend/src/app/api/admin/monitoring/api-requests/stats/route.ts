import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS api_request_log (
    id BIGSERIAL PRIMARY KEY,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INT,
    duration_ms INT,
    ip_address TEXT,
    user_agent TEXT,
    request_body_size INT,
    response_body_size INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);

    const [summary, byStatus, byMethod] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*)::int AS total_requests,
          COALESCE(AVG(duration_ms), 0)::numeric AS avg_duration_ms,
          CASE WHEN COUNT(*) = 0 THEN 0
               ELSE (COUNT(*) FILTER (WHERE status_code >= 400))::float / COUNT(*) * 100
          END AS error_rate
        FROM api_request_log
      `),
      client.query(`
        SELECT status_code, COUNT(*)::int AS cnt
        FROM api_request_log
        WHERE status_code IS NOT NULL
        GROUP BY status_code
        ORDER BY status_code
      `),
      client.query(`
        SELECT method, COUNT(*)::int AS cnt
        FROM api_request_log
        GROUP BY method
        ORDER BY cnt DESC
      `),
    ]);

    const requestsByStatus: Record<string, number> = {};
    for (const row of byStatus.rows as Array<{ status_code: number; cnt: number }>) {
      requestsByStatus[String(row.status_code)] = row.cnt;
    }

    const requestsByMethod: Record<string, number> = {};
    for (const row of byMethod.rows as Array<{ method: string; cnt: number }>) {
      requestsByMethod[row.method] = row.cnt;
    }

    const s = summary.rows[0] as {
      total_requests: number;
      avg_duration_ms: string;
      error_rate: number;
    };

    return Response.json({
      totalRequests: s?.total_requests ?? 0,
      avgDurationMs: parseFloat(s?.avg_duration_ms ?? '0'),
      errorRate: parseFloat(String(s?.error_rate ?? '0')),
      requestsByStatus,
      requestsByMethod,
    });
  } finally {
    client.release();
  }
}
