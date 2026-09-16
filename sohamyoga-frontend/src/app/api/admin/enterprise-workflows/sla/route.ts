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
    const r = await client.query(`
      SELECT v.*,i.entity_name,i.reference_id
      FROM enterprise_sla_violations v
      LEFT JOIN enterprise_process_instances i ON i.id=v.instance_id
      ORDER BY v.hours_overdue DESC
    `);
    return Response.json({ violations: r.rows });
  } finally { client.release(); }
}
