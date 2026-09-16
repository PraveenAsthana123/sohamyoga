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
    const { rows } = await client.query('SELECT * FROM cost_optimization_actions ORDER BY estimated_savings DESC');
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
      `INSERT INTO cost_optimization_actions (title, service, action_type, estimated_savings, effort, status)
       VALUES ($1,$2,$3,$4,$5,'recommended') RETURNING *`,
      [body.title, body.service, body.action_type, body.estimated_savings || 0, body.effort || 'low']
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
