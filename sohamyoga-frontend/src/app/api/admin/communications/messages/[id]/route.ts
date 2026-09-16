import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVISION_SQL = `
CREATE TABLE IF NOT EXISTS comm_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type TEXT NOT NULL,
  channel_name TEXT,
  status TEXT DEFAULT 'disconnected',
  config_json JSONB DEFAULT '{}',
  credentials_set BOOLEAN DEFAULT false,
  last_message_at TIMESTAMPTZ,
  messages_today INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS comm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES comm_channels(id),
  channel_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  contact_name TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  body_html TEXT,
  status TEXT DEFAULT 'received',
  external_id TEXT,
  thread_id TEXT,
  attachments_json JSONB DEFAULT '[]',
  metadata_json JSONB DEFAULT '{}',
  is_starred BOOLEAN DEFAULT false,
  is_spam BOOLEAN DEFAULT false,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
`;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(PROVISION_SQL);

    const msgResult = await client.query(
      `SELECT m.*, c.channel_name FROM comm_messages m
       LEFT JOIN comm_channels c ON c.id = m.channel_id
       WHERE m.id = $1 AND m.status != 'deleted'`,
      [params.id],
    );

    if (msgResult.rowCount === 0) {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }

    const msg = msgResult.rows[0];

    // Fetch thread messages if thread_id exists
    let thread: unknown[] = [];
    if (msg.thread_id) {
      const threadResult = await client.query(
        `SELECT m.*, c.channel_name FROM comm_messages m
         LEFT JOIN comm_channels c ON c.id = m.channel_id
         WHERE m.thread_id = $1 AND m.status != 'deleted'
         ORDER BY m.received_at ASC`,
        [msg.thread_id],
      );
      thread = threadResult.rows;
    }

    // Auto-mark as read if inbound and not yet read
    if (msg.direction === 'inbound' && msg.status === 'received') {
      await client.query(
        `UPDATE comm_messages SET status = 'read', read_at = NOW() WHERE id = $1`,
        [params.id],
      );
      msg.status = 'read';
      msg.read_at = new Date();
    }

    return Response.json({ message: msg, thread });
  } catch (err) {
    console.error('[comm/messages/[id] GET]', err);
    return Response.json({ error: 'Failed to fetch message' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(PROVISION_SQL);

    const body = await req.json() as {
      status?: string;
      is_starred?: boolean;
      is_spam?: boolean;
      mark_read?: boolean;
    };

    const sets: string[] = [];
    const values: unknown[] = [params.id];

    if (body.mark_read === true) {
      sets.push(`status = 'read'`);
      sets.push(`read_at = NOW()`);
    }
    if (typeof body.status === 'string') {
      values.push(body.status);
      sets.push(`status = $${values.length}`);
    }
    if (typeof body.is_starred === 'boolean') {
      values.push(body.is_starred);
      sets.push(`is_starred = $${values.length}`);
    }
    if (typeof body.is_spam === 'boolean') {
      values.push(body.is_spam);
      sets.push(`is_spam = $${values.length}`);
    }

    if (sets.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    const result = await client.query(
      `UPDATE comm_messages SET ${sets.join(', ')} WHERE id = $1 AND status != 'deleted' RETURNING *`,
      values,
    );

    if (result.rowCount === 0) {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }

    return Response.json({ message: result.rows[0] });
  } catch (err) {
    console.error('[comm/messages/[id] PATCH]', err);
    return Response.json({ error: 'Failed to update message' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(PROVISION_SQL);

    const result = await client.query(
      `UPDATE comm_messages SET status = 'deleted' WHERE id = $1 AND status != 'deleted' RETURNING id`,
      [params.id],
    );

    if (result.rowCount === 0) {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }

    return Response.json({ deleted: true, id: params.id });
  } catch (err) {
    console.error('[comm/messages/[id] DELETE]', err);
    return Response.json({ error: 'Failed to delete message' }, { status: 500 });
  } finally {
    client.release();
  }
}
