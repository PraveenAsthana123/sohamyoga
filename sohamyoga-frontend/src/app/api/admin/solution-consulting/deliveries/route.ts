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
    const { rows } = await client.query(`
      SELECT d.*, o.client_name, o.value AS opp_value
      FROM consulting_deliveries d
      LEFT JOIN consulting_opportunities o ON o.id=d.opportunity_id
      ORDER BY d.created_at DESC`);
    return Response.json({ deliveries: rows });
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
      `INSERT INTO consulting_deliveries (opportunity_id,name,status,milestones,team_members,start_date,end_date,health)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.opportunity_id || null, b.name, b.status || 'planning', JSON.stringify(b.milestones || []),
       b.team_members || [], b.start_date || null, b.end_date || null, b.health || 'green']
    );
    return Response.json({ delivery: rows[0] }, { status: 201 });
  } finally { client.release(); }
}
