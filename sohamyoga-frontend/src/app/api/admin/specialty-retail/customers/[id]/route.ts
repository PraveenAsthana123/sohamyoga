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
      const [custRes, histRes] = await Promise.all([
        client.query(`SELECT * FROM sr_customer WHERE id=$1`, [parseInt(params.id)]),
        client.query(`SELECT s.*, (SELECT json_agg(json_build_object('name',p.name,'qty',si.quantity,'price',si.unit_price)) FROM sr_sale_item si JOIN sr_product p ON p.id=si.product_id WHERE si.sale_id=s.id) AS items FROM sr_sale s WHERE s.customer_id=$1 ORDER BY s.sale_date DESC LIMIT 10`, [parseInt(params.id)]),
      ]);
      if (!custRes.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ...custRes.rows[0], purchase_history: histRes.rows });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = Object.keys(body).filter(k => k !== 'id');
      const sets = fields.map((k, i) => `${k}=$${i + 2}`).join(', ');
      const vals = fields.map(k => body[k]);
      const { rows } = await client.query(`UPDATE sr_customer SET ${sets} WHERE id=$1 RETURNING *`, [parseInt(params.id), ...vals]);
      return NextResponse.json(rows[0]);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
