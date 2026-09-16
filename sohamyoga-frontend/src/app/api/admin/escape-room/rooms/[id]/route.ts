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
    const r = await client.query(`SELECT * FROM er_room WHERE id=$1`, [params.id]);
    if (!r.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ room: r.rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const allowed = ['room_name','theme','description','difficulty','min_players','max_players','duration_minutes','price_per_person','min_booking_amount','is_active','success_rate_pct'];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const f of allowed) {
      if (body[f] !== undefined) { sets.push(`${f}=$${values.length+1}`); values.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    values.push(params.id);
    const r = await client.query(
      `UPDATE er_room SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`,
      values
    );
    return Response.json({ room: r.rows[0] });
  } finally {
    client.release();
  }
}
