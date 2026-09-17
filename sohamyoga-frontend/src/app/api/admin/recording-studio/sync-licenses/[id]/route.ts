import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT sl.*, p.project_name FROM rs_sync_licenses sl LEFT JOIN rs_projects p ON p.id = sl.project_id WHERE sl.id = $1`,
      [params.id]
    );
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const allowed = ['track_name','licensee_name','use_type','territory','license_fee','exclusivity','status','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const key of allowed) {
      if (key in body) { vals.push(body[key]); sets.push(`${key} = $${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE rs_sync_licenses SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
