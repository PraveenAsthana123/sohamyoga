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
    const { rows } = await client.query(`
      SELECT id, agent_name, caller_number, direction, duration_seconds, outcome, sentiment,
             transcript_snippet, cost_usd, created_at
      FROM voice_ai_calls
      ORDER BY created_at DESC
      LIMIT 50
    `);
    return Response.json({ calls: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { agent_name, caller_number, direction, duration_seconds, outcome, sentiment, transcript_snippet, cost_usd } = body;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      INSERT INTO voice_ai_calls (agent_name, caller_number, direction, duration_seconds, outcome, sentiment, transcript_snippet, cost_usd)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [agent_name, caller_number, direction ?? 'inbound', duration_seconds ?? 0, outcome ?? 'completed', sentiment ?? 'neutral', transcript_snippet, cost_usd ?? 0]);
    return Response.json({ call: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
