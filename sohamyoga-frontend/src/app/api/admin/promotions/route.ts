import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS promotion (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    promotion_type TEXT DEFAULT 'percentage',
    discount_value NUMERIC DEFAULT 0,
    min_order_value NUMERIC DEFAULT 0,
    max_discount_amount NUMERIC,
    applicable_to TEXT DEFAULT 'all',
    product_ids INTEGER[],
    category_ids INTEGER[],
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_stackable BOOLEAN DEFAULT false,
    requires_coupon BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (status) { conditions.push(`status = $${values.length + 1}`); values.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await client.query(
      `SELECT * FROM promotion ${where} ORDER BY created_at DESC LIMIT 500`,
      values
    );
    return Response.json({ promotions: result.rows });
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
    name, description, promotion_type = 'percentage', discount_value = 0,
    min_order_value = 0, max_discount_amount, applicable_to = 'all',
    product_ids, category_ids, start_date, end_date, usage_limit,
    is_stackable = false, requires_coupon = false, status = 'draft'
  } = body as Record<string, unknown>;

  if (!name || typeof name !== 'string') return Response.json({ error: 'name required.' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);
    const result = await client.query(
      `INSERT INTO promotion (name, description, promotion_type, discount_value, min_order_value,
        max_discount_amount, applicable_to, product_ids, category_ids, start_date, end_date,
        usage_limit, is_stackable, requires_coupon, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [name, description, promotion_type, discount_value, min_order_value,
       max_discount_amount, applicable_to, product_ids ?? null, category_ids ?? null,
       start_date, end_date, usage_limit, is_stackable, requires_coupon, status]
    );
    return Response.json({ promotion: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const { id, ...fields } = body as Record<string, unknown>;
  if (!id) return Response.json({ error: 'id required.' }, { status: 400 });

  const allowed = ['name','description','promotion_type','discount_value','min_order_value',
    'max_discount_amount','applicable_to','product_ids','category_ids','start_date',
    'end_date','usage_limit','is_stackable','requires_coupon','status'];

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) { sets.push(`${k} = $${values.length + 1}`); values.push(v); }
  }
  if (!sets.length) return Response.json({ error: 'No updatable fields.' }, { status: 400 });

  values.push(id);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE promotion SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rowCount) return Response.json({ error: 'Promotion not found.' }, { status: 404 });
    return Response.json({ promotion: result.rows[0] });
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
      `UPDATE promotion SET status = 'cancelled' WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rowCount) return Response.json({ error: 'Promotion not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
