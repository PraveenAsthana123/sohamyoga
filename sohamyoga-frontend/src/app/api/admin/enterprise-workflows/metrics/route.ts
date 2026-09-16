export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [byType, onTime, throughput] = await Promise.all([
      client.query(`
        SELECT process_type,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status='completed') as completed,
          COUNT(*) FILTER (WHERE status='active') as active,
          AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at,NOW()) - started_at))/3600)::NUMERIC(10,1) as avg_cycle_hours
        FROM enterprise_process_instances
        GROUP BY process_type ORDER BY process_type
      `),
      client.query(`
        SELECT process_type,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status='completed' AND completed_at <= started_at + sla_hours * interval '1 hour') as on_time,
          ROUND(COUNT(*) FILTER (WHERE status='completed' AND completed_at <= started_at + sla_hours * interval '1 hour')::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE status='completed'),0) * 100, 1) as on_time_pct
        FROM enterprise_process_instances
        GROUP BY process_type
      `),
      client.query(`
        SELECT DATE_TRUNC('day',started_at) as day, COUNT(*) as count
        FROM enterprise_process_instances
        WHERE started_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day
      `),
    ]);
    return Response.json({ by_type: byType.rows, on_time: onTime.rows, throughput: throughput.rows });
  } finally { client.release(); }
}
