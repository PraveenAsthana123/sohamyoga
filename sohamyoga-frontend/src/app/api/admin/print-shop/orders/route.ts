import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function generateOrderNumber(client: import('pg').PoolClient): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT COUNT(*) AS n FROM ps_order WHERE order_number LIKE $1`, [`PS-${year}-%`]
  );
  const seq = String(parseInt(rows[0].n) + 1).padStart(4, '0');
  return `PS-${year}-${seq}`;
}

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const product_type = searchParams.get('product_type');
    const rush = searchParams.get('rush');
    let q = `
      SELECT o.*, c.first_name || ' ' || c.last_name AS customer_name, c.company, c.discount_pct
      FROM ps_order o LEFT JOIN ps_customer c ON c.id = o.customer_id WHERE 1=1
    `;
    const vals: string[] = [];
    let idx = 1;
    if (status) { q += ` AND o.status = $${idx++}`; vals.push(status); }
    if (product_type) { q += ` AND o.product_type = $${idx++}`; vals.push(product_type); }
    if (rush === 'true') { q += ` AND o.rush_order = true`; }
    q += ` ORDER BY o.due_date NULLS LAST, o.rush_order DESC, o.created_at DESC`;
    const { rows } = await client.query(q, vals);
    return NextResponse.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const order_number = body.order_number || await generateOrderNumber(client);
    const total_price = body.total_price ?? (body.unit_price && body.quantity ? body.unit_price * body.quantity + (body.setup_fee ?? 0) + (body.rush_fee ?? 0) : null);
    const balance_due = total_price != null ? total_price - (body.deposit_paid ?? 0) : null;
    const { rows } = await client.query(`
      INSERT INTO ps_order (customer_id, order_number, product_type, quantity, size, paper_stock, finish, sides, color_mode, rush_order, unit_price, total_price, setup_fee, rush_fee, deposit_paid, balance_due, due_date, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `, [
      body.customer_id ?? null, order_number, body.product_type, body.quantity,
      body.size ?? null, body.paper_stock ?? null, body.finish ?? 'none',
      body.sides ?? 'single', body.color_mode ?? 'full_color',
      body.rush_order ?? false, body.unit_price ?? null, total_price,
      body.setup_fee ?? 0, body.rush_fee ?? 0, body.deposit_paid ?? 0, balance_due,
      body.due_date ?? null, body.notes ?? null,
    ]);
    return NextResponse.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
