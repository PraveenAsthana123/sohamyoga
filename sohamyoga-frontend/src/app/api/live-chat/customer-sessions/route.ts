import { NextRequest } from 'next/server';
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

// Public: get or create a session for a visitor
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const visitorId = searchParams.get('visitorId') ?? '';

  if (!visitorId.trim()) {
    return Response.json({ error: 'visitorId is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query(CREATE_SESSION);

    const result = await client.query(
      `SELECT id, visitor_id, status, started_at, ended_at, unread_count
       FROM live_chat_session
       WHERE visitor_id = $1
       ORDER BY started_at DESC`,
      [visitorId.trim()],
    );

    return Response.json({ sessions: result.rows });
  } finally {
    client.release();
  }
}

// Public: create a new session for a visitor
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { visitorId: string };

  if (!body.visitorId?.trim()) {
    return Response.json({ error: 'visitorId is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query(CREATE_SESSION);

    const result = await client.query(
      `INSERT INTO live_chat_session (visitor_id, status)
       VALUES ($1, 'active')
       RETURNING id, visitor_id, status, started_at, unread_count`,
      [body.visitorId.trim()],
    );

    return Response.json({ session: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
