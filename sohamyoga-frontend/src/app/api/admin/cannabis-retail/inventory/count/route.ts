import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { staff_id, counts } = body; // counts: [{product_id, actual_count}]
  if (!staff_id || !counts?.length) return Response.json({ error: 'staff_id and counts array required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const discrepancies: {sku:string;product_name:string;system:number;actual:number;diff:number}[] = [];
    for (const item of counts as {product_id:number;actual_count:number}[]) {
      const { rows } = await client.query(`SELECT * FROM cr_product WHERE id=$1`, [item.product_id]);
      if (!rows.length) continue;
      const prod = rows[0] as {id:number;sku:string;product_name:string;stock_quantity:number};
      const diff = item.actual_count - prod.stock_quantity;
      if (diff !== 0) discrepancies.push({ sku: prod.sku, product_name: prod.product_name, system: prod.stock_quantity, actual: item.actual_count, diff });
      await client.query(`UPDATE cr_product SET stock_quantity=$1 WHERE id=$2`, [item.actual_count, item.product_id]);
    }
    // Log the count event
    await client.query(`
      INSERT INTO cr_compliance_log (log_type, staff_involved, description, action_taken)
      VALUES ('inventory_count', $1, $2, 'Physical count recorded and system quantities updated')
    `, [staff_id, `Physical inventory count conducted. ${counts.length} SKUs counted. ${discrepancies.length} discrepancies found.`]);
    await client.query('COMMIT');
    return Response.json({ reconciled: counts.length, discrepancies });
  } catch (err) {
    await client.query('ROLLBACK');
    return Response.json({ error: String(err) }, { status: 500 });
  } finally { client.release(); }
}
