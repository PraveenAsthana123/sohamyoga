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

const CREATE_MESSAGE = `
  CREATE TABLE IF NOT EXISTS live_chat_message (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES live_chat_session(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

// GET: return messages for a session (public — visitor needs session id to access)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionId)) {
    return Response.json({ error: 'Invalid session id' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query(CREATE_SESSION);
    await client.query(CREATE_MESSAGE);

    const sessionCheck = await client.query(
      `SELECT id, visitor_id, status, started_at, ended_at FROM live_chat_session WHERE id = $1`,
      [sessionId],
    );
    if (!sessionCheck.rows.length) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const messages = await client.query(
      `SELECT id, session_id, sender_role, content, created_at
       FROM live_chat_message
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId],
    );

    // Reset unread count when history is fetched
    await client.query(
      `UPDATE live_chat_session SET unread_count = 0 WHERE id = $1`,
      [sessionId],
    );

    return Response.json({
      session: sessionCheck.rows[0],
      messages: messages.rows,
      count: messages.rows.length,
    });
  } finally {
    client.release();
  }
}

// POST: send a message in a session (public)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionId)) {
    return Response.json({ error: 'Invalid session id' }, { status: 400 });
  }

  const body = (await req.json()) as { sender_role: string; content: string };

  if (!body.sender_role?.trim() || !body.content?.trim()) {
    return Response.json({ error: 'sender_role and content are required' }, { status: 400 });
  }

  const validRoles = ['visitor', 'agent', 'bot'];
  if (!validRoles.includes(body.sender_role)) {
    return Response.json({ error: `sender_role must be one of: ${validRoles.join(', ')}` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const sessionCheck = await client.query(
      `SELECT id FROM live_chat_session WHERE id = $1 AND status = 'active'`,
      [sessionId],
    );
    if (!sessionCheck.rows.length) {
      return Response.json({ error: 'Session not found or not active' }, { status: 404 });
    }

    const result = await client.query(
      `INSERT INTO live_chat_message (session_id, sender_role, content)
       VALUES ($1, $2, $3)
       RETURNING id, session_id, sender_role, content, created_at`,
      [sessionId, body.sender_role, body.content.trim()],
    );

    // Increment unread count for agent-facing messages from visitor
    if (body.sender_role === 'visitor') {
      await client.query(
        `UPDATE live_chat_session SET unread_count = unread_count + 1 WHERE id = $1`,
        [sessionId],
      );
    }

    return Response.json({ message: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
