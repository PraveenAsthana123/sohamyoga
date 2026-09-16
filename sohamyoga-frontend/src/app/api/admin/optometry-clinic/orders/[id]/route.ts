import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS_FLOW: Record<string, string> = { ordered: 'lab', lab: 'ready', ready: 'dispensed' };

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT o.*, p.first_name, p.last_name, p.phone, p.email
       FROM opt_order o JOIN opt_patient p ON p.id = o.patient_id WHERE o.id = $1`, [params.id]);
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
    if (b.advance_status) {
      const { rows: [cur] } = await client.query(`SELECT status FROM opt_order WHERE id = $1`, [params.id]);
      if (!cur) return Response.json({ error: 'Not found' }, { status: 404 });
      const next = STATUS_FLOW[cur.status];
      if (!next) return Response.json({ error: 'Cannot advance from current status' }, { status: 400 });
      const dispensedDate = next === 'dispensed' ? new Date().toISOString().slice(0, 10) : null;
      const { rows } = await client.query(
        `UPDATE opt_order SET status = $1 ${dispensedDate ? ', dispensed_date = $3' : ''} WHERE id = $2 RETURNING *`,
        dispensedDate ? [next, params.id, dispensedDate] : [next, params.id]
      );
      return Response.json(rows[0]);
    }
    const fields = ['order_type','frame_sku','lens_type','lens_coating','contact_brand','contact_quantity','total_amount','deposit_paid','insurance_claimed','patient_balance','status','lab_reference','expected_ready_date','dispensed_date','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (b[f] !== undefined) { vals.push(b[f]); sets.push(`${f} = $${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE opt_order SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
