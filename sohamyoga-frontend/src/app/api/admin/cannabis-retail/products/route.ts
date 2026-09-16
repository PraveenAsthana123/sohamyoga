import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const compliance_status = searchParams.get('compliance_status');
  const low_stock = searchParams.get('low_stock');
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT * FROM cr_product
      WHERE ($1::text IS NULL OR category=$1)
        AND ($2::text IS NULL OR compliance_status=$2)
        AND ($3::text IS NULL OR ($3='true' AND stock_quantity <= reorder_point))
      ORDER BY brand, product_name
    `, [category||null, compliance_status||null, low_stock||null]);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { brand, product_name, sku, upc, category, subcategory, thc_pct, cbd_pct, weight_grams, unit_count, province_sku, cost_price, retail_price, stock_quantity, reorder_point, storage_location } = body;
  if (!brand || !product_name || !sku || !category) return Response.json({ error: 'brand, product_name, sku, category required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      INSERT INTO cr_product (brand, product_name, sku, upc, category, subcategory, thc_pct, cbd_pct, weight_grams, unit_count, province_sku, cost_price, retail_price, stock_quantity, reorder_point, storage_location)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *
    `, [brand, product_name, sku, upc||null, category, subcategory||null, thc_pct||null, cbd_pct||null, weight_grams||null, unit_count||null, province_sku||null, cost_price||null, retail_price||null, stock_quantity??0, reorder_point??5, storage_location||null]);
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
