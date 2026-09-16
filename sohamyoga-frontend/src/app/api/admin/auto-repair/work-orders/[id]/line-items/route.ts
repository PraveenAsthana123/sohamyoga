import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function recalcWO(client: Awaited<ReturnType<ReturnType<typeof getPool>['connect']>>, wo_id: string): Promise<void> {
  const { rows } = await client.query(`SELECT COALESCE(SUM(quantity * unit_price),0) AS sub FROM ar_line_item WHERE work_order_id=$1`, [wo_id]);
  const subtotal = parseFloat(rows[0].sub);
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  await client.query(`UPDATE ar_work_order SET subtotal=$1, tax_amount=$2, total_amount=$3 WHERE id=$4`, [subtotal, tax, subtotal + tax, wo_id]);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM ar_line_item WHERE work_order_id=$1 ORDER BY created_at`, [params.id]);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { item_type, description, part_number, quantity, unit_cost, unit_price, labour_hours, technician } = body;
  if (!item_type || !description || unit_price == null) return Response.json({ error: 'item_type, description, unit_price required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      INSERT INTO ar_line_item (work_order_id, item_type, description, part_number, quantity, unit_cost, unit_price, labour_hours, technician)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [params.id, item_type, description, part_number||null, quantity??1, unit_cost||null, unit_price, labour_hours||null, technician||null]);
    await recalcWO(client, params.id);
    await client.query('COMMIT');
    return Response.json(rows[0], { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    return Response.json({ error: String(err) }, { status: 500 });
  } finally { client.release(); }
}
