import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS coupon (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    promotion_id INTEGER REFERENCES promotion(id) ON DELETE SET NULL,
    coupon_type TEXT DEFAULT 'single_use',
    discount_type TEXT DEFAULT 'percentage',
    discount_value NUMERIC NOT NULL,
    min_order_value NUMERIC DEFAULT 0,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    applicable_to TEXT DEFAULT 'all',
    customer_email TEXT,
    created_by TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS coupon_redemption (
    id SERIAL PRIMARY KEY,
    coupon_id INTEGER REFERENCES coupon(id) ON DELETE CASCADE,
    order_id INTEGER,
    customer_email TEXT,
    discount_applied NUMERIC,
    redeemed_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

function generateCode(prefix = ''): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix.toUpperCase();
  const needed = Math.max(8 - code.length, 4);
  for (let i = 0; i < needed; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code.substring(0, Math.max(8, prefix.length + 4));
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLES);
    const [coupons, redemptions] = await Promise.all([
      client.query(`
        SELECT c.*,
          (SELECT COUNT(*) FROM coupon_redemption cr WHERE cr.coupon_id = c.id) AS redemption_count,
          (c.valid_until IS NOT NULL AND c.valid_until < NOW()) AS is_expired
        FROM coupon c ORDER BY c.created_at DESC LIMIT 500
      `),
      client.query(`
        SELECT cr.*, c.code FROM coupon_redemption cr
        JOIN coupon c ON c.id = cr.coupon_id
        ORDER BY cr.redeemed_at DESC LIMIT 500
      `),
    ]);
    return Response.json({ coupons: coupons.rows, redemptions: redemptions.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const {
    code: rawCode, promotion_id, coupon_type = 'single_use',
    discount_type = 'percentage', discount_value, min_order_value = 0,
    max_uses, valid_until, applicable_to = 'all', customer_email, created_by
  } = body as Record<string, unknown>;

  if (discount_value === undefined || discount_value === null) {
    return Response.json({ error: 'discount_value required.' }, { status: 400 });
  }

  const code = rawCode && typeof rawCode === 'string' && rawCode.trim()
    ? rawCode.trim().toUpperCase()
    : generateCode();

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLES);
    const result = await client.query(
      `INSERT INTO coupon (code, promotion_id, coupon_type, discount_type, discount_value,
        min_order_value, max_uses, valid_until, applicable_to, customer_email, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [code, promotion_id ?? null, coupon_type, discount_type, discount_value,
       min_order_value, max_uses ?? null, valid_until ?? null, applicable_to, customer_email ?? null, created_by ?? null]
    );
    return Response.json({ coupon: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') return Response.json({ error: 'Coupon code already exists.' }, { status: 409 });
    throw err;
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const { id, is_active, valid_until } = body as Record<string, unknown>;
  if (!id) return Response.json({ error: 'id required.' }, { status: 400 });

  const sets: string[] = [];
  const values: unknown[] = [];
  if (is_active !== undefined) { sets.push(`is_active = $${values.length + 1}`); values.push(is_active); }
  if (valid_until !== undefined) { sets.push(`valid_until = $${values.length + 1}`); values.push(valid_until); }
  if (!sets.length) return Response.json({ error: 'No fields to update.' }, { status: 400 });

  values.push(id);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE coupon SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rowCount) return Response.json({ error: 'Coupon not found.' }, { status: 404 });
    return Response.json({ coupon: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id required.' }, { status: 400 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE coupon SET is_active = false WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rowCount) return Response.json({ error: 'Coupon not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
