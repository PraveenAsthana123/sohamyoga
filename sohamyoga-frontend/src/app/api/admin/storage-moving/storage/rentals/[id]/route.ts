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
    const { rows } = await client.query(`SELECT sr.*, c.first_name, c.last_name, su.unit_number, su.unit_size FROM sm_storage_rental sr JOIN sm_customer c ON c.id = sr.customer_id JOIN sm_storage_unit su ON su.id = sr.unit_id WHERE sr.id = $1`, [params.id]);
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
    await client.query('BEGIN');

    if (b.vacate) {
      const today = new Date().toISOString().slice(0, 10);
      const { rows } = await client.query(
        `UPDATE sm_storage_rental SET status = 'vacated', end_date = $1 WHERE id = $2 RETURNING unit_id`,
        [today, params.id]
      );
      if (rows[0]) {
        await client.query(`UPDATE sm_storage_unit SET is_occupied = false WHERE id = $1`, [rows[0].unit_id]);
      }
      await client.query('COMMIT');
      return Response.json({ success: true, vacated_date: today });
    }

    if (b.record_payment) {
      const today = new Date().toISOString().slice(0, 10);
      const { rows } = await client.query(
        `UPDATE sm_storage_rental SET last_payment_date = $1, status = 'active', payment_method = COALESCE($2, payment_method) WHERE id = $3 RETURNING *`,
        [today, b.payment_method ?? null, params.id]
      );
      await client.query('COMMIT');
      return Response.json(rows[0]);
    }

    const fields = ['monthly_rate','access_code','status','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (b[f] !== undefined) { vals.push(b[f]); sets.push(`${f} = $${vals.length}`); }
    }
    if (!sets.length) { await client.query('ROLLBACK'); return Response.json({ error: 'Nothing to update' }, { status: 400 }); }
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE sm_storage_rental SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
    await client.query('COMMIT');
    return Response.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}
