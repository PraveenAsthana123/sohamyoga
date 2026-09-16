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
    const { rows: [customer] } = await client.query(`SELECT * FROM sm_customer WHERE id = $1`, [params.id]);
    if (!customer) return Response.json({ error: 'Not found' }, { status: 404 });
    const { rows: moves } = await client.query(`SELECT * FROM sm_move WHERE customer_id = $1 ORDER BY move_date DESC`, [params.id]);
    const { rows: rentals } = await client.query(`SELECT sr.*, su.unit_number, su.unit_size, su.unit_type FROM sm_storage_rental sr JOIN sm_storage_unit su ON su.id = sr.unit_id WHERE sr.customer_id = $1 ORDER BY sr.created_at DESC`, [params.id]);
    return Response.json({ ...customer, moves, rentals });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const fields = ['first_name','last_name','email','phone','current_address','new_address','city','province','referral_source','customer_type','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (b[f] !== undefined) { vals.push(b[f]); sets.push(`${f} = $${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE sm_customer SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
