import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    await requireAdmin(req);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [saleRes, itemsRes] = await Promise.all([
        client.query(`SELECT s.*, c.first_name, c.last_name FROM sr_sale s LEFT JOIN sr_customer c ON c.id=s.customer_id WHERE s.id=$1`, [parseInt(params.id)]),
        client.query(`SELECT si.*, p.name, p.sku, p.category FROM sr_sale_item si JOIN sr_product p ON p.id=si.product_id WHERE si.sale_id=$1`, [parseInt(params.id)]),
      ]);
      if (!saleRes.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ...saleRes.rows[0], items: itemsRes.rows });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
