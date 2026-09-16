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
    const [venue, upcoming] = await Promise.all([
      client.query(`SELECT * FROM wv_venue WHERE id=$1`, [params.id]),
      client.query(
        `SELECT id,couple_name1,couple_name2,event_date,guest_count,status,total_package_price
         FROM wv_booking WHERE venue_id=$1 AND event_date>=CURRENT_DATE AND status!='cancelled'
         ORDER BY event_date LIMIT 10`,
        [params.id]
      ),
    ]);
    if (!venue.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ venue: venue.rows[0], upcoming_bookings: upcoming.rows });
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
    const allowed = ['venue_name','venue_type','capacity_min','capacity_max','base_price','price_type','amenities','description','is_active'];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const f of allowed) {
      if (body[f] !== undefined) { sets.push(`${f}=$${values.length+1}`); values.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    values.push(params.id);
    const r = await client.query(`UPDATE wv_venue SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`, values);
    return Response.json({ venue: r.rows[0] });
  } finally {
    client.release();
  }
}
