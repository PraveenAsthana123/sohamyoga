import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { reason } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: prodRows } = await client.query(`UPDATE cr_product SET compliance_status='recalled' WHERE id=$1 RETURNING *`, [params.id]);
    if (!prodRows.length) { await client.query('ROLLBACK'); return Response.json({ error: 'Product not found' }, { status: 404 }); }
    const prod = prodRows[0];
    await client.query(`
      INSERT INTO cr_compliance_log (log_type, description, action_taken, aglc_report_required)
      VALUES ('product_recall', $1, 'Product pulled from active inventory and flagged recalled', true)
    `, [`RECALL: ${prod.brand} ${prod.product_name} (SKU: ${prod.sku})${reason ? ' — ' + reason : ''}`]);
    await client.query('COMMIT');
    return Response.json({ recalled: true, product: prod });
  } catch (err) {
    await client.query('ROLLBACK');
    return Response.json({ error: String(err) }, { status: 500 });
  } finally { client.release(); }
}
