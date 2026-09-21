import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const lowStock = req.nextUrl.searchParams.get('low_stock') === 'true';
    const where = lowStock ? `WHERE quantity_on_hand <= reorder_point` : '';
    const rows = await client.query(`SELECT * FROM rx_inventory ${where} ORDER BY drug_name LIMIT 500`);
    return Response.json(rows.rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `INSERT INTO rx_inventory (din,drug_name,brand_name,manufacturer,strength,form,quantity_on_hand,reorder_point,reorder_quantity,unit_cost,selling_price,location,expiry_date,narcotic)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (din) DO UPDATE SET quantity_on_hand = rx_inventory.quantity_on_hand + EXCLUDED.quantity_on_hand
       RETURNING *`,
      [b.din, b.drug_name, b.brand_name, b.manufacturer, b.strength, b.form,
       b.quantity_on_hand ?? 0, b.reorder_point ?? 50, b.reorder_quantity ?? 200,
       b.unit_cost, b.selling_price, b.location, b.expiry_date, b.narcotic ?? false]
    );
    return Response.json(row.rows[0], { status: 201 });
  } finally { client.release(); }
}
