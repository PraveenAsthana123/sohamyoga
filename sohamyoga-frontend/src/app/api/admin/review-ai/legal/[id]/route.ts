export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const { id } = await params;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const resolvedAt = body.status === 'resolved' ? 'NOW()' : 'resolved_at';
    const { rows } = await client.query(
      `UPDATE legal_escalations SET status=COALESCE($1,status), resolution=COALESCE($2,resolution),
       legal_notes=COALESCE($3,legal_notes), assigned_to=COALESCE($4,assigned_to),
       resolved_at=CASE WHEN $1='resolved' THEN NOW() ELSE ${resolvedAt} END WHERE id=$5 RETURNING *`,
      [body.status, body.resolution, body.legal_notes, body.assigned_to, id]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}
