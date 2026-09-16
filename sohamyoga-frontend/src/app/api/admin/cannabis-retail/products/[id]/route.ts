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
    const { rows } = await client.query(`SELECT * FROM cr_product WHERE id=$1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const fields = ['brand','product_name','sku','upc','category','subcategory','thc_pct','cbd_pct','weight_grams','unit_count','province_sku','cost_price','retail_price','stock_quantity','reorder_point','storage_location','compliance_status','is_active'];
  const updates = fields.filter(f => f in body);
  if (!updates.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const sets = updates.map((f,i) => `${f}=$${i+1}`).join(',');
    const vals = updates.map(f => body[f]);
    const { rows } = await client.query(`UPDATE cr_product SET ${sets} WHERE id=$${updates.length+1} RETURNING *`, [...vals, params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}
