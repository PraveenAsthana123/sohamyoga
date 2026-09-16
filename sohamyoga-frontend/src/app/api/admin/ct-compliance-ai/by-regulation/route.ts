export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        regulation,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'compliant')::int AS compliant,
        COUNT(*) FILTER (WHERE status = 'partial')::int AS partial,
        COUNT(*) FILTER (WHERE status = 'non_compliant')::int AS non_compliant,
        ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'compliant') / NULLIF(COUNT(*), 0), 1) AS compliance_pct
      FROM compliance_ai_checks
      GROUP BY regulation
      ORDER BY compliance_pct ASC
    `).catch(() => ({ rows: [] }));

    return Response.json({ by_regulation: rows });
  } finally {
    client.release();
  }
}
