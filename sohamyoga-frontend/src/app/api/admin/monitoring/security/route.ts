import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SuspiciousIp {
  ip: string;
  count: number;
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    // 1. Count 401 responses in api_request_log (last 24h)
    const unauthorizedResult = await client
      .query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM api_request_log
         WHERE status_code = 401
           AND created_at >= NOW() - INTERVAL '24 hours'`,
      )
      .catch(() => ({ rows: [{ count: '0' }] }));

    const unauthorized_count = parseInt(unauthorizedResult.rows[0]?.count ?? '0', 10);

    // 2. Count flagged mcp_tool_call rows
    const flaggedAiResult = await client
      .query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM mcp_tool_call
         WHERE flagged = true`,
      )
      .catch(() => ({ rows: [{ count: '0' }] }));

    const flagged_ai_calls = parseInt(flaggedAiResult.rows[0]?.count ?? '0', 10);

    // 3. Recent login failures from login_audit_event (last 24h)
    const loginFailResult = await client
      .query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM login_audit_event
         WHERE event_type ILIKE '%fail%'
           AND occurred_at >= NOW() - INTERVAL '24 hours'`,
      )
      .catch(() => ({ rows: [{ count: '0' }] }));

    const failed_logins = parseInt(loginFailResult.rows[0]?.count ?? '0', 10);

    // 4. IPs with 10+ failed requests (4xx/5xx) in api_request_log (last 24h)
    const suspiciousResult = await client
      .query<{ ip_address: string; count: string }>(
        `SELECT ip_address, COUNT(*)::text AS count
         FROM api_request_log
         WHERE status_code >= 400
           AND ip_address IS NOT NULL
           AND created_at >= NOW() - INTERVAL '24 hours'
         GROUP BY ip_address
         HAVING COUNT(*) >= 10
         ORDER BY COUNT(*) DESC
         LIMIT 50`,
      )
      .catch(() => ({ rows: [] }));

    const suspicious_ips: SuspiciousIp[] = suspiciousResult.rows.map((r) => ({
      ip: r.ip_address,
      count: parseInt(r.count, 10),
    }));

    return Response.json({
      unauthorized_count,
      flagged_ai_calls,
      failed_logins,
      suspicious_ips,
      generated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
