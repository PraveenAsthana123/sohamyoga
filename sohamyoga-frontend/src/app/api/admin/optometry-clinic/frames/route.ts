import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get('brand') ?? '';
    const lowStock = searchParams.get('low_stock') === 'true';
    let where = 'WHERE is_active = true';
    const vals: unknown[] = [];
    if (brand) { vals.push(`%${brand}%`); where += ` AND brand ILIKE $${vals.length}`; }
    if (lowStock) { where += ` AND quantity_on_hand <= reorder_point`; }
    const { rows } = await client.query(`SELECT * FROM opt_frame_inventory ${where} ORDER BY brand, model LIMIT 200`, vals);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO opt_frame_inventory (brand, model, sku, color, size, frame_type, material, cost_price, retail_price, quantity_on_hand, reorder_point)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [b.brand, b.model, b.sku, b.color ?? null, b.size ?? null, b.frame_type ?? null, b.material ?? null, b.cost_price ?? null, b.retail_price ?? null, b.quantity_on_hand ?? 0, b.reorder_point ?? 2]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
