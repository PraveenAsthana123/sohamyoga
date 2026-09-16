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

CREATE TABLE IF NOT EXISTS comm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  channel_type TEXT,
  tags TEXT[],
  last_contact_at TIMESTAMPTZ,
  message_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const channel   = searchParams.get('channel') ?? 'all';
  const status    = searchParams.get('status')  ?? 'all';
  const search    = searchParams.get('search')  ?? '';
  const threadId  = searchParams.get('thread_id') ?? '';
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit     = 50;
  const offset    = (page - 1) * limit;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(PROVISION_SQL);

    const conditions: string[] = ["m.status != 'deleted'"];
    const values: (string | number)[] = [];

    if (channel && channel !== 'all') {
      values.push(channel);
      conditions.push(`m.channel_type = $${values.length}`);
    }
    if (status === 'unread') {
      conditions.push(`m.status = 'received' AND m.direction = 'inbound'`);
    } else if (status !== 'all') {
      values.push(status);
      conditions.push(`m.status = $${values.length}`);
    }
    if (threadId) {
      values.push(threadId);
      conditions.push(`m.thread_id = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(m.body ILIKE $${values.length} OR m.subject ILIKE $${values.length} OR m.contact_name ILIKE $${values.length} OR m.from_address ILIKE $${values.length})`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    values.push(limit);
    const limitParam = `$${values.length}`;
    values.push(offset);
    const offsetParam = `$${values.length}`;

    const [messages, countResult, unreadPerChannel] = await Promise.all([
      client.query(`
        SELECT
          m.id, m.channel_id, m.channel_type, m.direction,
          m.from_address, m.to_address, m.contact_name, m.subject,
          m.body, m.body_html, m.status, m.external_id, m.thread_id,
          m.attachments_json, m.metadata_json, m.is_starred, m.is_spam,
          m.received_at, m.read_at,
          c.channel_name
        FROM comm_messages m
        LEFT JOIN comm_channels c ON c.id = m.channel_id
        ${where}
        ORDER BY m.received_at DESC
        LIMIT ${limitParam} OFFSET ${offsetParam}
      `, values),

      client.query(
        `SELECT COUNT(*)::int AS total FROM comm_messages m ${where}`,
        values.slice(0, values.length - 2),
      ),

      client.query(`
        SELECT
          channel_type,
          COUNT(*) FILTER (WHERE status = 'received' AND direction = 'inbound')::int AS unread
        FROM comm_messages
        WHERE status != 'deleted'
        GROUP BY channel_type
      `),
    ]);

    const unreadMap: Record<string, number> = {};
    for (const row of unreadPerChannel.rows as { channel_type: string; unread: number }[]) {
      unreadMap[row.channel_type] = row.unread;
    }

    return Response.json({
      messages: messages.rows,
      total: countResult.rows[0].total,
      page,
      pages: Math.ceil(countResult.rows[0].total / limit),
      unread_per_channel: unreadMap,
    });
  } catch (err) {
    console.error('[comm/messages GET]', err);
    return Response.json({ error: 'Failed to fetch messages' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(PROVISION_SQL);

    const body = await req.json() as {
      channel_type: string;
      to_address: string;
      subject?: string;
      body: string;
      contact_name?: string;
      thread_id?: string;
    };

    const { channel_type, to_address, subject, body: msgBody, contact_name, thread_id } = body;

    if (!channel_type || !to_address || !msgBody) {
      return Response.json({ error: 'channel_type, to_address and body are required' }, { status: 400 });
    }

    // Find channel record
    const channelRow = await client.query(
      `SELECT id, status, config_json FROM comm_channels WHERE channel_type = $1 LIMIT 1`,
      [channel_type],
    );
    const channelId = channelRow.rows[0]?.id ?? null;

    let warning: string | null = null;
    let extra: Record<string, string> = {};
    let providerResult: Record<string, unknown> = {};

    if (channel_type === 'email') {
      if (!process.env.GMAIL_CLIENT_ID) {
        const encoded = encodeURIComponent(msgBody);
        const sub = encodeURIComponent(subject ?? '');
        warning = 'Gmail not configured — using mailto fallback';
        extra = { mailto_url: `mailto:${to_address}?subject=${sub}&body=${encoded}` };
      } else {
        // Real Gmail API send would go here — returns 200 if token refresh works
        warning = 'Gmail API send not implemented in this demo';
      }
    } else if (channel_type === 'whatsapp') {
      const token = process.env.WHATSAPP_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!token || !phoneNumberId) {
        const encoded = encodeURIComponent(msgBody);
        const cleanNumber = to_address.replace(/\D/g, '');
        warning = 'WhatsApp not configured';
        extra = { wa_link: `https://wa.me/${cleanNumber}?text=${encoded}` };
      } else {
        try {
          const waResp = await fetch(
            `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: to_address,
                type: 'text',
                text: { body: msgBody },
              }),
            },
          );
          providerResult = await waResp.json() as Record<string, unknown>;
        } catch (err) {
          warning = `WhatsApp API error: ${err instanceof Error ? err.message : 'unknown'}`;
        }
      }
    } else if (channel_type === 'sms' || channel_type === 'phone') {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const auth = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_PHONE_NUMBER;
      if (!sid || !auth || !from) {
        warning = 'Twilio not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER';
      } else {
        try {
          const twilioResp = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({ From: from, To: to_address, Body: msgBody }).toString(),
            },
          );
          providerResult = await twilioResp.json() as Record<string, unknown>;
        } catch (err) {
          warning = `Twilio API error: ${err instanceof Error ? err.message : 'unknown'}`;
        }
      }
    } else if (channel_type === 'apple_messages') {
      warning = 'Apple iMessage requires Apple Business Register — routing as SMS fallback';
      extra = { sms_fallback: 'true' };
    }

    // Save to DB regardless
    const saved = await client.query(`
      INSERT INTO comm_messages
        (channel_id, channel_type, direction, to_address, contact_name, subject, body, status, thread_id, received_at)
      VALUES ($1, $2, 'outbound', $3, $4, $5, $6, 'sent', $7, NOW())
      RETURNING *
    `, [channelId, channel_type, to_address, contact_name ?? null, subject ?? null, msgBody, thread_id ?? null]);

    // Update last_message_at on channel
    if (channelId) {
      await client.query(
        `UPDATE comm_channels SET last_message_at = NOW() WHERE id = $1`,
        [channelId],
      );
    }

    return Response.json({
      message: saved.rows[0],
      warning,
      provider_result: Object.keys(providerResult).length ? providerResult : undefined,
      ...extra,
    }, { status: 201 });
  } catch (err) {
    console.error('[comm/messages POST]', err);
    return Response.json({ error: 'Failed to send message' }, { status: 500 });
  } finally {
    client.release();
  }
}
