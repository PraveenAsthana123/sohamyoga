export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: agents } = await client.query(`SELECT * FROM voice_ai_agents ORDER BY name`);
    const { rows: scripts } = await client.query(`SELECT * FROM voice_ai_scripts ORDER BY created_at DESC`);
    return Response.json({ agents, scripts });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { name, voice_id, persona, script, status } = body;
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      INSERT INTO voice_ai_agents (name, voice_id, persona, script, status)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [name, voice_id, persona, script, status ?? 'active']);
    return Response.json({ agent: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
