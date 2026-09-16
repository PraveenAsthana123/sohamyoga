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
    const r = await client.query(`SELECT * FROM er_promo ORDER BY created_at DESC`);
    return Response.json({ promos: r.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO er_promo (code,description,discount_type,discount_value,valid_from,valid_until,max_uses)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.code.toUpperCase(),body.description,body.discount_type,body.discount_value,
       body.valid_from||null,body.valid_until||null,body.max_uses||null]
    );
    return Response.json({ promo: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
