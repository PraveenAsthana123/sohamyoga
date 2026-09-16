import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_SESSION = `
  CREATE TABLE IF NOT EXISTS live_chat_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    unread_count INT DEFAULT 0
  )
`;

const CREATE_MESSAGE = `
  CREATE TABLE IF NOT EXISTS live_chat_message (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES live_chat_session(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

// Admin: list all sessions with message count
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';

  const client = await pool.connect();
  try {
    await client.query(CREATE_SESSION);
    await client.query(CREATE_MESSAGE);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (status) {
      conditions.push(`lcs.status = $${values.length + 1}`);
      values.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await client.query(
      `SELECT lcs.id, lcs.visitor_id, lcs.status, lcs.started_at, lcs.ended_at, lcs.unread_count,
              COUNT(lcm.id)::int AS message_count,
              MAX(lcm.created_at) AS last_message_at
       FROM live_chat_session lcs
       LEFT JOIN live_chat_message lcm ON lcm.session_id = lcs.id
       ${where}
       GROUP BY lcs.id
       ORDER BY lcs.started_at DESC`,
      values,
    );

    return Response.json({ sessions: result.rows });
  } finally {
    client.release();
  }
}
