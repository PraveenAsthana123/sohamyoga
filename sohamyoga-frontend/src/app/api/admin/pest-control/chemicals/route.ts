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
    const low_stock = searchParams.get('low_stock') === 'true';
    const restricted = searchParams.get('restricted_use');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (low_stock) { conditions.push(`quantity_on_hand <= reorder_threshold`); }
    if (restricted !== null) { conditions.push(`restricted_use = $${idx++}`); vals.push(restricted === 'true'); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT * FROM pc_chemicals ${where} ORDER BY product_name`,
      vals
    );
    return Response.json({ chemicals: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b?.product_name) return Response.json({ error: 'product_name is required.' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO pc_chemicals (product_name, pcpa_reg_number, active_ingredient, formulation_type, target_pests, restricted_use, quantity_on_hand, unit, reorder_threshold, cost_per_unit, expiry_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [b.product_name, b.pcpa_reg_number ?? null, b.active_ingredient ?? null, b.formulation_type ?? null, b.target_pests ?? null, b.restricted_use ?? false, b.quantity_on_hand ?? 0, b.unit ?? null, b.reorder_threshold ?? null, b.cost_per_unit ?? null, b.expiry_date ?? null, b.notes ?? null]
    );
    return Response.json({ chemical: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
