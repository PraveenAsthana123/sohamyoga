// The real send step. No real email/SMS provider credentials exist
// anywhere in this workspace (confirmed in a prior session — zero SMTP/
// SES/SendGrid config). This route NEVER simulates a successful send —
// every queued message in this campaign is marked 'not_configured' with a
// clear, honest error_message, whether send_mode is 'draft' or
// 'automatic'. The queue/compose UI above this is fully real; only the
// final delivery hop is gated on credentials that don't exist yet.

import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../../lib/session-auth';
import { query } from '../../../../../lib/postgres';

const NOT_CONFIGURED_REASON = 'NOT_CONFIGURED: no real email/SMS provider credentials (SMTP/SES/SendGrid/Twilio) exist in this workspace. The message is queued and ready — configure a provider to enable real delivery.';

export async function POST(req: NextRequest, { params }: { params: { campaignId: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const campaign = await query<{ id: string; send_mode: string }>(`SELECT id, send_mode FROM campaign WHERE id = $1`, [params.campaignId]);
  if (!campaign.rowCount) return Response.json({ error: 'Campaign not found.' }, { status: 404 });

  const result = await query(
    `UPDATE campaign_message
     SET status = 'not_configured', error_message = $1
     WHERE campaign_id = $2 AND status = 'queued'
     RETURNING id`,
    [NOT_CONFIGURED_REASON, params.campaignId],
  );

  await query(`UPDATE campaign SET status = 'active', updated_at = now() WHERE id = $1`, [params.campaignId]);

  return Response.json({
    result: 'NOT_CONFIGURED',
    reason: NOT_CONFIGURED_REASON,
    messagesAffected: result.rowCount ?? 0,
  });
}
