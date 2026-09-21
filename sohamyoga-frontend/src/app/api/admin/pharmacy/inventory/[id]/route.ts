import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const row = await client.query(`SELECT * FROM rx_inventory WHERE id = $1`, [params.id]);
    if (!row.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    // If adjust_quantity provided, add/subtract from current stock
    let qUpdate = '';
    if (typeof b.adjust_quantity === 'number') {
      qUpdate = `, quantity_on_hand = GREATEST(0, quantity_on_hand + ${b.adjust_quantity})`;
    } else if (typeof b.quantity_on_hand === 'number') {
      qUpdate = `, quantity_on_hand = ${b.quantity_on_hand}`;
    }
    const row = await client.query(
      `UPDATE rx_inventory SET
        drug_name=COALESCE($1,drug_name),
        expiry_date=COALESCE($2,expiry_date),
        reorder_point=COALESCE($3,reorder_point),
        location=COALESCE($4,location),
        selling_price=COALESCE($5,selling_price)
        ${qUpdate}
       WHERE id=$6 RETURNING *`,
      [b.drug_name, b.expiry_date, b.reorder_point, b.location, b.selling_price, params.id]
    );
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}
