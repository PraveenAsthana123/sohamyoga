// WhatsAppMessageQueueJob — every 15 minutes
// Processes scheduled WhatsApp Business messages: dispatches via Cloud API when
// credentials are available, flags 24-hour customer-initiated window expiry, and
// updates social_post status. Mirrors FirstWaveDispatchJob's honest-gating pattern.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function publishWhatsApp(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
  mediaUrl?: string,
): Promise<string | null> {
  const body = mediaUrl
    ? { messaging_product: 'whatsapp', to, type: 'image', image: { link: mediaUrl } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } };

  const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errMsg = (json.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
    throw new Error(`WhatsApp API error: ${errMsg}`);
  }
  const messages = json.messages as Array<{ id: string }> | undefined;
  return messages?.[0]?.id ?? null;
}

export async function run(): Promise<void> {
  let dispatched = 0;
  let blocked = 0;
  let expired = 0;

  // 1. Flag expired 24-hour customer-initiated window
  const expireResult = await db.query(`
    UPDATE social_post
       SET status = 'failed',
           failure_reason = '24-hour customer-initiated messaging window expired',
           updated_at = now()
     WHERE platform = 'whatsapp_business'
       AND status = 'scheduled'
       AND scheduled_at < now() - INTERVAL '24 hours'
  `);
  expired = expireResult.rowCount ?? 0;

  // 2. Find due scheduled posts
  const due = await db.query<{
    id: string; tenant_id: string; account_id: string;
    platform_account_id: string; caption: string | null;
    media_urls: string[] | null; credentials: Record<string, string>;
    idempotency_key: string;
  }>(`
    SELECT sp.id, sp.tenant_id, sp.account_id, sp.platform_account_id,
           uci.caption, uci.media_urls,
           sa.credentials, sp.idempotency_key
      FROM social_post sp
      JOIN social_account sa ON sa.id = sp.account_id AND sa.platform = 'whatsapp_business' AND sa.status = 'connected'
      LEFT JOIN unified_content_item uci ON uci.source_id = sp.idempotency_key AND uci.platform = 'whatsapp_business'
     WHERE sp.platform = 'whatsapp_business'
       AND sp.status = 'scheduled'
       AND sp.scheduled_at <= now()
       AND sp.scheduled_at > now() - INTERVAL '24 hours'
     ORDER BY sp.scheduled_at
     LIMIT 20
  `);

  for (const row of due.rows) {
    const creds = row.credentials ?? {};
    const phoneNumberId = creds['WHATSAPP_PHONE_NUMBER_ID'] ?? '';
    const accessToken = creds['WHATSAPP_ACCESS_TOKEN'] ?? '';

    if (!phoneNumberId || !accessToken) {
      await db.query(
        `UPDATE social_post SET status = 'failed', failure_reason = $2, updated_at = now() WHERE id = $1`,
        [row.id, 'Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in connected account credentials'],
      );
      blocked++;
      continue;
    }

    try {
      const messageId = await publishWhatsApp(
        phoneNumberId,
        accessToken,
        row.platform_account_id,
        row.caption ?? '',
        row.media_urls?.[0],
      );
      await db.query(
        `UPDATE social_post SET status = 'published', published_at = now(), external_post_id = $2, updated_at = now() WHERE id = $1`,
        [row.id, messageId],
      );
      dispatched++;
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 500) : 'Unknown error';
      await db.query(
        `UPDATE social_post SET status = 'failed', failure_reason = $2, updated_at = now() WHERE id = $1`,
        [row.id, msg],
      );
      console.error(`[whatsapp-message-queue] failed post=${row.id}:`, msg);
    }
  }

  if (dispatched + blocked + expired > 0) {
    console.log(`[whatsapp-message-queue] dispatched=${dispatched} blocked=${blocked} expired=${expired}`);
  }
}
