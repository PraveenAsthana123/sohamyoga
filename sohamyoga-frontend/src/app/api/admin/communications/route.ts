import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import type { PoolClient } from 'pg';

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

async function seedIfEmpty(client: PoolClient) {
  const existing = await client.query('SELECT COUNT(*) AS cnt FROM comm_channels');
  if (Number(existing.rows[0].cnt) > 0) return;

  // Seed channels
  const channelResult = await client.query(`
    INSERT INTO comm_channels (channel_type, channel_name, status, config_json, credentials_set)
    VALUES
      ('email',          'Gmail (Demo)',       'demo',         '{"address":"demo@sohamyoga.com"}',       false),
      ('whatsapp',       'WhatsApp Business',  'disconnected', '{"phone_number_id":""}',                 false),
      ('sms',            'Twilio SMS',         'disconnected', '{"phone_number":""}',                    false),
      ('phone',          'Twilio Voice',       'disconnected', '{"phone_number":""}',                    false),
      ('apple_messages', 'Apple Messages',     'demo',         '{"note":"Requires Apple Business Register"}', false)
    RETURNING id, channel_type
  `);

  const channelMap: Record<string, string> = {};
  for (const row of channelResult.rows) {
    channelMap[row.channel_type] = row.id;
  }

  // Seed contacts
  await client.query(`
    INSERT INTO comm_contacts (name, email, phone, whatsapp_number, channel_type, tags, last_contact_at, message_count)
    VALUES
      ('Priya Sharma',    'priya@example.com',  '+14161110001', '+14161110001', 'email',     ARRAY['student','yoga'],    NOW() - INTERVAL '2 hours',   5),
      ('Amit Patel',      'amit@example.com',   '+14161110002', '+14161110002', 'whatsapp',  ARRAY['instructor','vip'],  NOW() - INTERVAL '1 day',     3),
      ('Sarah Johnson',   'sarah@example.com',  '+14161110003', '+14161110003', 'sms',       ARRAY['student'],           NOW() - INTERVAL '3 days',    2),
      ('Ravi Kumar',      'ravi@example.com',   '+14161110004', '+14161110004', 'email',     ARRAY['trial'],             NOW() - INTERVAL '1 week',    1),
      ('Meera Nair',      'meera@example.com',  '+14161110005', '+14161110005', 'whatsapp',  ARRAY['student','premium'], NOW() - INTERVAL '30 minutes',8),
      ('David Chen',      'david@example.com',  '+14161110006', '+14161110006', 'sms',       ARRAY['lead'],              NOW() - INTERVAL '5 days',    1)
  `);

  const threadId1 = 'thread-email-001';
  const threadId2 = 'thread-wa-001';
  const threadId3 = 'thread-sms-001';

  await client.query(`
    INSERT INTO comm_messages
      (channel_id, channel_type, direction, from_address, to_address, contact_name, subject, body, body_html, status, thread_id, received_at)
    VALUES
      ($1, 'email', 'inbound',  'priya@example.com',      'demo@sohamyoga.com', 'Priya Sharma',  'Class Schedule Inquiry',
        'Hi, I would like to know the upcoming yoga class schedule for October. Thanks!',
        '<p>Hi, I would like to know the upcoming yoga class schedule for October. Thanks!</p>',
        'received', $6, NOW() - INTERVAL '2 hours'),

      ($1, 'email', 'outbound', 'demo@sohamyoga.com',      'priya@example.com', 'Priya Sharma',  'Re: Class Schedule Inquiry',
        'Hi Priya, thank you for reaching out! Our October schedule is posted at sohamyoga.com/schedule. We have morning classes at 7am and evening classes at 6pm Mon-Sat.',
        '<p>Hi Priya, thank you for reaching out! Our October schedule is posted at sohamyoga.com/schedule.</p>',
        'sent', $6, NOW() - INTERVAL '1 hour 45 minutes'),

      ($1, 'email', 'inbound',  'ravi@example.com',        'demo@sohamyoga.com', 'Ravi Kumar',   'Trial Class Availability',
        'Hello, I am interested in trying a free trial class. Do you offer introductory sessions?',
        '<p>Hello, I am interested in trying a free trial class. Do you offer introductory sessions?</p>',
        'received', 'thread-email-002', NOW() - INTERVAL '1 week'),

      ($1, 'email', 'inbound',  'sarah@example.com',       'demo@sohamyoga.com', 'Sarah Johnson','Membership Renewal',
        'My membership expires next week. Can you send me the renewal options please?',
        '<p>My membership expires next week. Can you send me the renewal options please?</p>',
        'received', 'thread-email-003', NOW() - INTERVAL '3 days'),

      ($2, 'whatsapp', 'inbound',  '+14161110002',  '+1-demo-wa', 'Amit Patel',  NULL,
        'Hey! Quick question about the instructor certification program?',
        NULL, 'received', $7, NOW() - INTERVAL '1 day'),

      ($2, 'whatsapp', 'outbound', '+1-demo-wa',    '+14161110002', 'Amit Patel', NULL,
        'Hi Amit! Our 200-hour YTT certification starts November 1st. Would you like to register?',
        NULL, 'sent', $7, NOW() - INTERVAL '23 hours'),

      ($2, 'whatsapp', 'inbound',  '+14161110005',  '+1-demo-wa', 'Meera Nair',  NULL,
        'Is the prenatal yoga class still available on Saturdays?',
        NULL, 'received', 'thread-wa-002', NOW() - INTERVAL '30 minutes'),

      ($2, 'whatsapp', 'inbound',  '+14161110005',  '+1-demo-wa', 'Meera Nair',  NULL,
        'Also, do you have gift cards available?',
        NULL, 'received', 'thread-wa-002', NOW() - INTERVAL '25 minutes'),

      ($3, 'sms', 'inbound',  '+14161110003', '+1-demo-sms', 'Sarah Johnson', NULL,
        'Hi, reminder about my booking tomorrow at 9am?',
        NULL, 'received', $8, NOW() - INTERVAL '3 days'),

      ($3, 'sms', 'outbound', '+1-demo-sms', '+14161110003', 'Sarah Johnson', NULL,
        'Yes Sarah! Your booking for tomorrow at 9am with instructor Priya is confirmed. See you then!',
        NULL, 'sent', $8, NOW() - INTERVAL '2 days 23 hours'),

      ($3, 'sms', 'inbound',  '+14161110006', '+1-demo-sms', 'David Chen', NULL,
        'How much is the drop-in rate?',
        NULL, 'received', 'thread-sms-002', NOW() - INTERVAL '5 days'),

      ($4, 'phone', 'inbound',  '+14161110001', '+1-demo-voice', 'Priya Sharma', NULL,
        '[Phone Call] Duration: 3m 24s — Inquiry about class schedule',
        NULL, 'read', 'thread-phone-001', NOW() - INTERVAL '4 days'),

      ($4, 'phone', 'inbound',  '+14161110004', '+1-demo-voice', 'Ravi Kumar', NULL,
        '[Phone Call] Duration: 1m 12s — Trial class inquiry',
        NULL, 'read', 'thread-phone-002', NOW() - INTERVAL '6 days'),

      ($5, 'apple_messages', 'inbound', 'user@icloud.com', 'demo@sohamyoga.com', 'iMessage User', NULL,
        'Hi, sent from iPhone. Interested in kids yoga classes!',
        NULL, 'received', 'thread-apple-001', NOW() - INTERVAL '12 hours'),

      ($5, 'apple_messages', 'outbound', 'demo@sohamyoga.com', 'user@icloud.com', 'iMessage User', NULL,
        'Thank you for reaching out! We do offer kids yoga on Saturdays 10-11am for ages 5-12. Would you like to book a spot?',
        NULL, 'sent', 'thread-apple-001', NOW() - INTERVAL '11 hours 30 minutes')
  `, [
    channelMap['email'],
    channelMap['whatsapp'],
    channelMap['sms'],
    channelMap['phone'],
    channelMap['apple_messages'],
    threadId1, threadId2, threadId3,
  ]);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(PROVISION_SQL);
    await seedIfEmpty(client);

    const channels = await client.query(`
      SELECT
        c.id, c.channel_type, c.channel_name, c.status,
        c.config_json, c.credentials_set, c.last_message_at,
        c.messages_today, c.created_at,
        COUNT(m.id) FILTER (WHERE m.status = 'received' AND m.direction = 'inbound')::int AS unread_count,
        COUNT(m.id)::int AS total_messages,
        MAX(m.received_at) AS latest_message_at
      FROM comm_channels c
      LEFT JOIN comm_messages m ON m.channel_id = c.id AND m.status != 'deleted'
      GROUP BY c.id
      ORDER BY c.created_at ASC
    `);

    const totals = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'received' AND direction = 'inbound')::int AS total_unread,
        COUNT(*) FILTER (WHERE received_at >= NOW() - INTERVAL '24 hours')::int AS messages_24h,
        COUNT(*) FILTER (WHERE received_at >= NOW() - INTERVAL '7 days')::int AS messages_7d
      FROM comm_messages
      WHERE status != 'deleted'
    `);

    return Response.json({
      channels: channels.rows,
      summary: totals.rows[0],
    });
  } catch (err) {
    console.error('[comm/channels GET]', err);
    return Response.json({ error: 'Failed to fetch channels' }, { status: 500 });
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
      id?: string;
      channel_type: string;
      channel_name?: string;
      status?: string;
      config_json?: Record<string, unknown>;
    };

    if (body.id) {
      // Update existing channel config
      const result = await client.query(`
        UPDATE comm_channels
        SET
          channel_name = COALESCE($2, channel_name),
          status       = COALESCE($3, status),
          config_json  = COALESCE($4, config_json)
        WHERE id = $1
        RETURNING *
      `, [body.id, body.channel_name ?? null, body.status ?? null, body.config_json ? JSON.stringify(body.config_json) : null]);

      if (result.rowCount === 0) {
        return Response.json({ error: 'Channel not found' }, { status: 404 });
      }
      return Response.json({ channel: result.rows[0] });
    }

    // Create new channel
    const result = await client.query(`
      INSERT INTO comm_channels (channel_type, channel_name, status, config_json)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [body.channel_type, body.channel_name ?? body.channel_type, body.status ?? 'disconnected', JSON.stringify(body.config_json ?? {})]);

    return Response.json({ channel: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[comm/channels POST]', err);
    return Response.json({ error: 'Failed to save channel' }, { status: 500 });
  } finally {
    client.release();
  }
}
