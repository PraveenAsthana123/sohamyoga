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
    const [saleRes, itemsRes] = await Promise.all([
      client.query(`SELECT * FROM cr_sale WHERE id=$1`, [params.id]),
      client.query(`SELECT si.*, p.brand, p.product_name, p.sku, p.category FROM cr_sale_item si JOIN cr_product p ON p.id=si.product_id WHERE si.sale_id=$1`, [params.id]),
    ]);
    if (!saleRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ sale: saleRes.rows[0], items: itemsRes.rows });
  } finally { client.release(); }
}
