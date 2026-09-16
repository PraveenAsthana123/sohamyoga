export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `UPDATE enterprise_process_instances SET status='completed',completed_at=NOW() WHERE id=$1 AND status='active' RETURNING *`,
      [params.id]
    );
    if (!r.rowCount) return Response.json({ error: 'Not found or already completed' }, { status: 404 });
    await client.query(
      `INSERT INTO enterprise_process_events (instance_id,stage,action,actor,notes) VALUES ($1,$2,'Process Completed',$3,$4)`,
      [params.id, r.rows[0].current_stage, body.actor || 'System', body.notes || 'Process completed successfully']
    );
    return Response.json({ instance: r.rows[0] });
  } finally { client.release(); }
}
