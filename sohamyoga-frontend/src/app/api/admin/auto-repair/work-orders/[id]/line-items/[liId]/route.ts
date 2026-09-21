import type { PoolClient } from 'pg';
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function recalcWO(client: PoolClient, wo_id: string): Promise<void> {
  const { rows } = await client.query(`SELECT COALESCE(SUM(quantity * unit_price),0) AS sub FROM ar_line_item WHERE work_order_id=$1`, [wo_id]);
  const subtotal = parseFloat(rows[0].sub);
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  await client.query(`UPDATE ar_work_order SET subtotal=$1, tax_amount=$2, total_amount=$3 WHERE id=$4`, [subtotal, tax, subtotal + tax, wo_id]);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; liId: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const fields = ['status','description','quantity','unit_price','unit_cost','labour_hours','technician','part_number'];
  const updates = fields.filter(f => f in body);
  if (!updates.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sets = updates.map((f,i) => `${f}=$${i+1}`).join(',');
    const vals = updates.map(f => body[f]);
    const { rows } = await client.query(`UPDATE ar_line_item SET ${sets} WHERE id=$${updates.length+1} AND work_order_id=$${updates.length+2} RETURNING *`, [...vals, params.liId, params.id]);
    if (!rows.length) { await client.query('ROLLBACK'); return Response.json({ error: 'Not found' }, { status: 404 }); }
    await recalcWO(client, params.id);
    await client.query('COMMIT');
    return Response.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    return Response.json({ error: String(err) }, { status: 500 });
  } finally { client.release(); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; liId: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ar_line_item WHERE id=$1 AND work_order_id=$2`, [params.liId, params.id]);
    await recalcWO(client, params.id);
    await client.query('COMMIT');
    return Response.json({ deleted: true });
  } catch (err) {
    await client.query('ROLLBACK');
    return Response.json({ error: String(err) }, { status: 500 });
  } finally { client.release(); }
}
