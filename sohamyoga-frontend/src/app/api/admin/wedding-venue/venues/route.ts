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
    const r = await client.query(`SELECT * FROM wv_venue ORDER BY venue_name`);
    return Response.json({ venues: r.rows });
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
      `INSERT INTO wv_venue (venue_name,venue_type,capacity_min,capacity_max,base_price,price_type,amenities,description)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.venue_name,body.venue_type,body.capacity_min||null,body.capacity_max||null,
       body.base_price,body.price_type||'per_day',
       body.amenities||null,body.description||null]
    );
    return Response.json({ venue: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
