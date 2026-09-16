import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const low_stock = searchParams.get('low_stock');
    const on_sale = searchParams.get('on_sale');
    const search = searchParams.get('search');
    const pool = getPool();
    const client = await pool.connect();
    try {
      let q = `SELECT * FROM sr_product WHERE is_active=true`;
      const params: any[] = [];
      if (category) { params.push(category); q += ` AND category=$${params.length}`; }
      if (low_stock === 'true') q += ` AND stock_quantity <= reorder_point`;
      if (on_sale === 'true') q += ` AND is_on_sale=true`;
      if (search) { params.push(`%${search}%`); q += ` AND (name ILIKE $${params.length} OR sku ILIKE $${params.length} OR brand ILIKE $${params.length})`; }
      q += ` ORDER BY category, name`;
      const { rows } = await client.query(q, params);
      return NextResponse.json(rows);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO sr_product (name, sku, category, subcategory, brand, description, cost_price, retail_price, sale_price, is_on_sale, stock_quantity, reorder_point, location, barcode, tags, is_seasonal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [body.name, body.sku, body.category, body.subcategory||null, body.brand||null, body.description||null, body.cost_price, body.retail_price, body.sale_price||null, body.is_on_sale||false, body.stock_quantity||0, body.reorder_point||5, body.location||null, body.barcode||null, body.tags||[], body.is_seasonal||false]
      );
      return NextResponse.json(rows[0], { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
