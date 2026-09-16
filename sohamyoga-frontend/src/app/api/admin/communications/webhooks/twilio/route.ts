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

function parseTwilioFormBody(raw: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of raw.split('&')) {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent((v ?? '').replace(/\+/g, ' '));
  }
  return params;
}

export async function POST(req: NextRequest): Promise<Response> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(PROVISION_SQL);

    // Twilio sends application/x-www-form-urlencoded
    const rawBody = await req.text();
    const form = parseTwilioFormBody(rawBody);

    const from       = form['From'] ?? '';
    const to         = form['To'] ?? '';
    const smsBody    = form['Body'] ?? '';
    const messageSid = form['MessageSid'] ?? form['SmsSid'] ?? '';
    const callSid    = form['CallSid'] ?? '';
    const callStatus = form['CallStatus'] ?? '';
    const recordingUrl = form['RecordingUrl'] ?? '';
    const callDuration = form['CallDuration'] ?? '';

    const isCall = Boolean(callSid && !messageSid);
    const channelType = isCall ? 'phone' : 'sms';

    // Find channel
    const channelRow = await client.query(
      `SELECT id FROM comm_channels WHERE channel_type = $1 LIMIT 1`,
      [channelType],
    );
    const channelId = channelRow.rows[0]?.id ?? null;

    // Deduplicate
    const extId = messageSid || callSid;
    if (extId) {
      const existing = await client.query(
        `SELECT id FROM comm_messages WHERE external_id = $1`,
        [extId],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        return new Response('<Response></Response>', {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }
    }

    let body: string;
    let metadata: Record<string, string> = {};

    if (isCall) {
      body = `[Phone Call] Status: ${callStatus}${callDuration ? ` | Duration: ${callDuration}s` : ''}${recordingUrl ? ` | Recording: ${recordingUrl}` : ''}`;
      metadata = { call_status: callStatus, call_duration: callDuration, recording_url: recordingUrl };
    } else {
      body = smsBody || '[empty SMS]';
    }

    await client.query(`
      INSERT INTO comm_messages
        (channel_id, channel_type, direction, from_address, to_address, body, status, external_id, thread_id, metadata_json, received_at)
      VALUES ($1, $2, 'inbound', $3, $4, $5, 'received', $6, $7, $8, NOW())
    `, [
      channelId,
      channelType,
      from,
      to,
      body,
      extId || null,
      `thread-${channelType}-${from}`,
      JSON.stringify(metadata),
    ]);

    if (channelId) {
      await client.query(
        `UPDATE comm_channels SET last_message_at = NOW() WHERE id = $1`,
        [channelId],
      );
    }

    console.log(`[Twilio Webhook] Saved ${channelType} from ${from}`);

    // Twilio expects TwiML response
    return new Response('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err) {
    console.error('[Twilio Webhook POST]', err);
    return new Response('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } finally {
    client.release();
  }
}
