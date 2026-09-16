import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const period = searchParams.get('period') ?? '30'; // days
  const pool = getPool();
  const client = await pool.connect();
  try {
    const cond = clientId ? `AND t.client_id=$2` : '';
    const vals: unknown[] = [parseInt(period, 10)];
    if (clientId) vals.push(clientId);
    const { rows } = await client.query(`
      SELECT
        c.id AS client_id,
        c.name AS client_name,
        c.sla_response_hours,
        c.sla_resolution_hours,
        COUNT(t.id) AS total_tickets,
        COUNT(t.id) FILTER (WHERE t.status IN ('resolved','closed')) AS resolved_tickets,
        COUNT(t.id) FILTER (WHERE t.sla_breach=true) AS breach_count,
        ROUND(AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/3600)::numeric, 2) AS avg_first_response_hours,
        ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600)::numeric, 2) AS avg_resolution_hours,
        CASE WHEN COUNT(t.id) > 0 THEN ROUND((COUNT(t.id) FILTER (WHERE t.sla_breach=false OR t.sla_breach IS NULL))::numeric / COUNT(t.id) * 100, 1) ELSE 100 END AS compliance_pct
      FROM it_client c
      LEFT JOIN it_ticket t ON t.client_id=c.id AND t.created_at >= NOW() - ($1 || ' days')::INTERVAL ${cond}
      GROUP BY c.id, c.name, c.sla_response_hours, c.sla_resolution_hours
      ORDER BY compliance_pct ASC
    `, vals);

    // Overall compliance
    const overall = rows.length > 0
      ? Math.round(rows.reduce((s: number, r) => s + Number(r.compliance_pct ?? 100), 0) / rows.length)
      : 100;

    // Breach list
    const breachVals: unknown[] = [parseInt(period, 10)];
    if (clientId) breachVals.push(clientId);
    const { rows: breaches } = await client.query(`
      SELECT t.*, c.name AS client_name FROM it_ticket t JOIN it_client c ON c.id=t.client_id
      WHERE t.sla_breach=true AND t.created_at >= NOW() - ($1 || ' days')::INTERVAL ${clientId ? 'AND t.client_id=$2' : ''}
      ORDER BY t.created_at DESC LIMIT 20
    `, breachVals);

    return Response.json({ sla: rows, overall, breaches, period: parseInt(period, 10) });
  } finally {
    client.release();
  }
}
