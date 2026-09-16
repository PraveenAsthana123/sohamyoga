import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const lowStock = req.nextUrl.searchParams.get('low_stock') === 'true';
    const where = lowStock ? `WHERE quantity_on_hand <= reorder_point` : '';
    const rows = await client.query(`SELECT * FROM hs_supply ${where} ORDER BY name LIMIT 500`);
    return Response.json(rows.rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    if (b.id) {
      // Update existing
      const row = await client.query(
        `UPDATE hs_supply SET quantity_on_hand = COALESCE($1, quantity_on_hand), reorder_point = COALESCE($2, reorder_point) WHERE id = $3 RETURNING *`,
        [b.quantity_on_hand, b.reorder_point, b.id]
      );
      return Response.json(row.rows[0]);
    }
    const row = await client.query(
      `INSERT INTO hs_supply (name,category,quantity_on_hand,unit,reorder_point,cost_per_unit,supplier) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.name, b.category, b.quantity_on_hand ?? 0, b.unit ?? 'unit', b.reorder_point ?? 5, b.cost_per_unit, b.supplier]
    );
    return Response.json(row.rows[0], { status: 201 });
  } finally { client.release(); }
}
