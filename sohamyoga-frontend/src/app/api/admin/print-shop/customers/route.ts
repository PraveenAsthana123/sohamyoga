import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    let q = `SELECT * FROM ps_customer WHERE 1=1`;
    const vals: string[] = [];
    if (type) { q += ` AND customer_type = $1`; vals.push(type); }
    q += ` ORDER BY last_name, first_name`;
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
    const { rows } = await client.query(`
      INSERT INTO ps_customer (first_name, last_name, email, phone, company, customer_type, billing_address, discount_pct, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [
      body.first_name, body.last_name, body.email, body.phone ?? null, body.company ?? null,
      body.customer_type ?? 'business', body.billing_address ?? null,
      body.discount_pct ?? 0, body.notes ?? null,
    ]);
    return NextResponse.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
