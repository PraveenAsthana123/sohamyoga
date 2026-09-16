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
    const { rows } = await client.query('SELECT * FROM lead_management_nurture_sequences ORDER BY created_at DESC');
    return Response.json({ sequences: rows });
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
      `INSERT INTO lead_management_nurture_sequences (name,steps,status) VALUES ($1,$2,$3) RETURNING *`,
      [b.name, JSON.stringify(b.steps || []), b.status || 'active']
    );
    return Response.json({ sequence: rows[0] }, { status: 201 });
  } finally { client.release(); }
}
