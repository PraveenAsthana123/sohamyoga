export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const inst = await client.query('SELECT * FROM enterprise_process_instances WHERE id=$1', [params.id]);
    if (!inst.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    const events = await client.query(
      'SELECT * FROM enterprise_process_events WHERE instance_id=$1 ORDER BY occurred_at',
      [params.id]
    );
    return Response.json({ instance: inst.rows[0], events: events.rows });
  } finally { client.release(); }
}
