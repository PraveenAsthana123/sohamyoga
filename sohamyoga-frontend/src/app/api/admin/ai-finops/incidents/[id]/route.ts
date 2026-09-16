export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { resolution, status } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const resolvedAt = status === 'resolved' ? 'NOW()' : 'resolved_at';
    const { rows } = await client.query(
      `UPDATE aiops_incidents
       SET status=$1, resolution=$2, resolved_at=${resolvedAt}
       WHERE id=$3 RETURNING *`,
      [status ?? 'resolved', resolution, params.id]
    );
    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ incident: rows[0] });
  } finally {
    client.release();
  }
}
