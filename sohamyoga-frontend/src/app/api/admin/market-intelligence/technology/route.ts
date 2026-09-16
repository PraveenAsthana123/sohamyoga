export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM technology_scouts ORDER BY relevance_score DESC');
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO technology_scouts (technology_name, category, maturity_level, vendor, use_case, relevance_score, adoption_timeline, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.technology_name, body.category, body.maturity_level || 'emerging', body.vendor, body.use_case, body.relevance_score || 3, body.adoption_timeline, body.status || 'monitoring', body.notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
