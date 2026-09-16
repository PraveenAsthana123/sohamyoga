import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const id = parseInt(params.id, 10);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [cgRes, schedRes] = await Promise.all([
        client.query(`SELECT * FROM sc_caregiver WHERE id=$1`, [id]),
        client.query(`SELECT s.*, c.first_name AS client_first, c.last_name AS client_last FROM sc_schedule s LEFT JOIN sc_client c ON c.id=s.client_id WHERE s.caregiver_id=$1 AND s.visit_date >= CURRENT_DATE ORDER BY s.visit_date, s.start_time LIMIT 14`, [id]),
      ]);
      if (!cgRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ...cgRes.rows[0], upcoming_schedule: schedRes.rows });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const id = parseInt(params.id, 10);
    const fields = ['first_name','last_name','email','phone','certification','languages','availability_days','status','hourly_rate'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (body[f] !== undefined) { vals.push(body[f]); sets.push(`${f}=$${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
    vals.push(id);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`UPDATE sc_caregiver SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
