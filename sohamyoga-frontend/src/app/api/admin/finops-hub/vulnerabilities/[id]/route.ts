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
    const { rows } = await client.query(
      `UPDATE vulnerability_findings SET status=COALESCE($1,status), remediation=COALESCE($2,remediation),
       resolved_at=CASE WHEN $1='resolved' THEN CURRENT_DATE ELSE resolved_at END WHERE id=$3 RETURNING *`,
      [body.status, body.remediation, id]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}
