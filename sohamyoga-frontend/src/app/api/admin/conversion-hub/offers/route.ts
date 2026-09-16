export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM conversion_offers ORDER BY conversions DESC');
    return Response.json({ offers: rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b || !b.name) return Response.json({ error: 'name required' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO conversion_offers (name,type,headline,cta,discount_pct,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [b.name, b.type || 'discount', b.headline || null, b.cta || null, b.discount_pct || 0, b.status || 'active']
    );
    return Response.json({ offer: rows[0] }, { status: 201 });
  } finally { client.release(); }
}
