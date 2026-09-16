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

const DEMO_MESSAGES = [
  {
    external_id: 'demo-gmail-001',
    from_address: 'newsletter@yogajournal.com',
    contact_name: 'Yoga Journal',
    subject: 'Your Weekly Yoga Inspiration',
    body: 'This week in Yoga Journal: 5 poses for stress relief, an interview with top instructors, and our new meditation guide. Read more at yogajournal.com',
    body_html: '<p>This week in Yoga Journal: <strong>5 poses for stress relief</strong>, an interview with top instructors, and our new meditation guide.</p>',
    thread_id: 'thread-gmail-demo-001',
    received_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    external_id: 'demo-gmail-002',
    from_address: 'bookings@mindbodyonline.com',
    contact_name: 'Mindbody',
    subject: 'New Class Booking Confirmation',
    body: 'A new booking has been confirmed for your Hatha Flow class on October 20th at 9:00 AM. Student: Priya Sharma (priya@example.com). Please ensure the studio is prepared.',
    body_html: '<p>A new booking has been confirmed for your <strong>Hatha Flow</strong> class on October 20th at 9:00 AM. Student: Priya Sharma.</p>',
    thread_id: 'thread-gmail-demo-002',
    received_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
  },
  {
    external_id: 'demo-gmail-003',
    from_address: 'support@stripe.com',
    contact_name: 'Stripe',
    subject: 'Payment received: $89.00',
    body: 'A payment of $89.00 was received from Meera Nair (meera@example.com) for "Monthly Unlimited Membership". Transaction ID: ch_3demo123. Funds will be deposited in 2 business days.',
    body_html: '<p>A payment of <strong>$89.00</strong> was received from Meera Nair for "Monthly Unlimited Membership".</p>',
    thread_id: 'thread-gmail-demo-003',
    received_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  },
];

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(PROVISION_SQL);

    // Find email channel
    const channelRow = await client.query(
      `SELECT id, config_json FROM comm_channels WHERE channel_type = 'email' LIMIT 1`,
    );
    const channelId = channelRow.rows[0]?.id ?? null;

    const isGmailConfigured = Boolean(
      process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN,
    );

    if (!isGmailConfigured) {
      // Insert demo messages, skipping duplicates
      const inserted: string[] = [];
      for (const demo of DEMO_MESSAGES) {
        const existing = await client.query(
          `SELECT id FROM comm_messages WHERE external_id = $1`,
          [demo.external_id],
        );
        if (existing.rowCount && existing.rowCount > 0) continue;

        await client.query(`
          INSERT INTO comm_messages
            (channel_id, channel_type, direction, from_address, contact_name, subject, body, body_html, status, external_id, thread_id, received_at)
          VALUES ($1, 'email', 'inbound', $2, $3, $4, $5, $6, 'received', $7, $8, $9)
        `, [
          channelId,
          demo.from_address,
          demo.contact_name,
          demo.subject,
          demo.body,
          demo.body_html,
          demo.external_id,
          demo.thread_id,
          demo.received_at,
        ]);
        inserted.push(demo.external_id);
      }

      if (channelId && inserted.length > 0) {
        await client.query(
          `UPDATE comm_channels SET last_message_at = NOW() WHERE id = $1`,
          [channelId],
        );
      }

      return Response.json({
        mode: 'demo',
        synced: inserted.length,
        skipped_duplicates: DEMO_MESSAGES.length - inserted.length,
        warning: 'Gmail not configured — set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN for real sync',
      });
    }

    // Real Gmail API sync path
    // 1. Exchange refresh token for access token
    let accessToken: string;
    try {
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GMAIL_CLIENT_ID!,
          client_secret: process.env.GMAIL_CLIENT_SECRET!,
          refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
          grant_type: 'refresh_token',
        }).toString(),
      });
      const tokenData = await tokenResp.json() as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        throw new Error(`Token refresh failed: ${tokenData.error ?? 'unknown'}`);
      }
      accessToken = tokenData.access_token;
    } catch (err) {
      return Response.json(
        { error: `Gmail auth failed: ${err instanceof Error ? err.message : 'unknown'}` },
        { status: 500 },
      );
    }

    // 2. List recent messages
    const listResp = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const listData = await listResp.json() as { messages?: { id: string }[]; error?: { message: string } };

    if (listData.error) {
      return Response.json({ error: `Gmail list error: ${listData.error.message}` }, { status: 500 });
    }

    const messageIds = (listData.messages ?? []).map(m => m.id);
    let syncedCount = 0;

    for (const msgId of messageIds) {
      const existing = await client.query(
        `SELECT id FROM comm_messages WHERE external_id = $1`,
        [msgId],
      );
      if (existing.rowCount && existing.rowCount > 0) continue;

      const msgResp = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const msgData = await msgResp.json() as {
        id: string;
        threadId: string;
        payload?: { headers?: { name: string; value: string }[] };
        snippet?: string;
        internalDate?: string;
      };

      const headers = msgData.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

      const subject    = getHeader('Subject');
      const fromRaw    = getHeader('From');
      const fromMatch  = fromRaw.match(/^(.*?)\s*<(.+?)>$/);
      const contactName = fromMatch?.[1]?.replace(/"/g, '').trim() ?? fromRaw;
      const fromAddress = fromMatch?.[2] ?? fromRaw;
      const receivedAt  = msgData.internalDate
        ? new Date(parseInt(msgData.internalDate, 10)).toISOString()
        : new Date().toISOString();

      await client.query(`
        INSERT INTO comm_messages
          (channel_id, channel_type, direction, from_address, contact_name, subject, body, status, external_id, thread_id, received_at)
        VALUES ($1, 'email', 'inbound', $2, $3, $4, $5, 'received', $6, $7, $8)
      `, [
        channelId,
        fromAddress,
        contactName,
        subject,
        msgData.snippet ?? '',
        msgData.id,
        `thread-gmail-${msgData.threadId}`,
        receivedAt,
      ]);

      syncedCount++;
    }

    if (channelId) {
      await client.query(
        `UPDATE comm_channels SET last_message_at = NOW(), status = 'connected' WHERE id = $1`,
        [channelId],
      );
    }

    return Response.json({ mode: 'real', synced: syncedCount, total_checked: messageIds.length });
  } catch (err) {
    console.error('[gmail sync POST]', err);
    return Response.json({ error: 'Gmail sync failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
