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
    const { rows } = await client.query('SELECT * FROM lead_management_icp ORDER BY created_at DESC');
    return Response.json({ profiles: rows });
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
      `INSERT INTO lead_management_icp (name,industry,company_size,pain_points,buying_signals)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [b.name, b.industry || null, b.company_size || null, b.pain_points || [], b.buying_signals || []]
    );
    return Response.json({ profile: rows[0] }, { status: 201 });
  } finally { client.release(); }
}
