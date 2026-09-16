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
    const [booking, tasks] = await Promise.all([
      client.query(
        `SELECT b.*,v.venue_name,v.venue_type FROM wv_booking b LEFT JOIN wv_venue v ON v.id=b.venue_id WHERE b.id=$1`,
        [params.id]
      ),
      client.query(
        `SELECT * FROM wv_planning_task WHERE booking_id=$1 ORDER BY due_date NULLS LAST, priority DESC`,
        [params.id]
      ),
    ]);
    if (!booking.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ booking: booking.rows[0], tasks: tasks.rows });
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
    const allowed = ['status','total_package_price','deposit_amount','deposit_paid','balance_due','balance_paid',
      'ceremony_time','reception_time','guest_count','catering_provider','florist','photographer',
      'wedding_coordinator','notes','ceremony_included','catering_included'];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const f of allowed) {
      if (body[f] !== undefined) { sets.push(`${f}=$${values.length+1}`); values.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    values.push(params.id);
    const r = await client.query(
      `UPDATE wv_booking SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`,
      values
    );
    return Response.json({ booking: r.rows[0] });
  } finally {
    client.release();
  }
}
