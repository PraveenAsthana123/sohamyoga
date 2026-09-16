import { NextRequest } from 'next/server';
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

// GET — WhatsApp webhook verification challenge
export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN ?? 'sohamyoga-whatsapp-token';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[WhatsApp Webhook] Verification successful');
    return new Response(challenge, { status: 200 });
  }

  console.warn('[WhatsApp Webhook] Verification failed — token mismatch or wrong mode');
  return new Response('Forbidden', { status: 403 });
}

// POST — incoming WhatsApp message
export async function POST(req: NextRequest): Promise<Response> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(PROVISION_SQL);

    const rawBody = await req.json() as Record<string, unknown>;

    // Parse Meta Cloud API payload structure
    const entry = (rawBody.entry as Record<string, unknown>[])?.[0];
    const change = (entry?.changes as Record<string, unknown>[])?.[0];
    const value = change?.value as Record<string, unknown> | undefined;
    const messages = value?.messages as Record<string, unknown>[] | undefined;

    if (!messages || messages.length === 0) {
      // Could be a status update — acknowledge and return
      return Response.json({ status: 'ok', note: 'no messages in payload' });
    }

    const waMsg = messages[0];
    const fromPhone   = waMsg.from as string;
    const externalId  = waMsg.id as string;
    const timestamp   = waMsg.timestamp as string;
    const textObj     = waMsg.text as { body?: string } | undefined;
    const msgBody     = textObj?.body ?? '[media or unsupported message type]';

    // Contact name from contacts array if present
    const contacts = value?.contacts as { profile?: { name?: string } }[] | undefined;
    const contactName = contacts?.[0]?.profile?.name ?? fromPhone;

    // Find WhatsApp channel
    const channelRow = await client.query(
      `SELECT id FROM comm_channels WHERE channel_type = 'whatsapp' LIMIT 1`,
    );
    const channelId = channelRow.rows[0]?.id ?? null;

    // Deduplicate by external_id
    const existing = await client.query(
      `SELECT id FROM comm_messages WHERE external_id = $1`,
      [externalId],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return Response.json({ status: 'ok', note: 'duplicate' });
    }

    const receivedAt = timestamp
      ? new Date(parseInt(timestamp, 10) * 1000).toISOString()
      : new Date().toISOString();

    await client.query(`
      INSERT INTO comm_messages
        (channel_id, channel_type, direction, from_address, contact_name, body, status, external_id, thread_id, received_at)
      VALUES ($1, 'whatsapp', 'inbound', $2, $3, $4, 'received', $5, $6, $7)
    `, [
      channelId,
      fromPhone,
      contactName,
      msgBody,
      externalId,
      `thread-wa-${fromPhone}`,
      receivedAt,
    ]);

    // Update channel last_message_at
    if (channelId) {
      await client.query(
        `UPDATE comm_channels SET last_message_at = NOW() WHERE id = $1`,
        [channelId],
      );
    }

    console.log(`[WhatsApp Webhook] Saved message from ${fromPhone}`);
    return Response.json({ status: 'ok' });
  } catch (err) {
    console.error('[WhatsApp Webhook POST]', err);
    // Always return 200 to Meta so they don't retry indefinitely
    return Response.json({ status: 'error', message: err instanceof Error ? err.message : 'unknown' });
  } finally {
    client.release();
  }
}
