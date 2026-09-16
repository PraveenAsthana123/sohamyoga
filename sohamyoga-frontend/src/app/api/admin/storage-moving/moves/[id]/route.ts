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
    const { rows } = await client.query(`SELECT m.*, c.first_name, c.last_name, c.phone, c.email FROM sm_move m JOIN sm_customer c ON c.id = m.customer_id WHERE m.id = $1`, [params.id]);
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const fields = ['move_type','move_date','move_time','origin_address','origin_city','destination_address','destination_city','estimated_hours','actual_hours','crew_size','truck_size','crew_members','status','quote_amount','final_amount','deposit_paid','balance_paid','elevator_booking_required','packing_service','special_items','storage_needed','customer_rating','customer_feedback','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (b[f] !== undefined) { vals.push(b[f]); sets.push(`${f} = $${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE sm_move SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
