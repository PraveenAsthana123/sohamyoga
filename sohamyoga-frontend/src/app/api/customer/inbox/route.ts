import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real customer-facing notification inbox, reading notification_queue
// (channel='in_app') for this customer's own identity user_id. Filtered to
// status='sent' only -- 'failed'/'pending'/'processing' are internal
// delivery-pipeline states, never something a customer should see rendered
// as if it were a real message. (Audited 2026-09-01: contrary to this
// route's earlier comment claiming zero customer-linked rows existed, most
// of notification_queue's rows -- e.g. the weekly community_digest -- ARE
// addressed to real students' identity user_id; they were only ever
// invisible here because NotificationDispatchJob incorrectly routed
// in_app-channel rows through the external Novu API, which 404'd every
// time. Fixed there; this filter is the honest complement, so a customer
// only ever sees notifications that genuinely reached them.)
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const notifications = await query(
    `SELECT id, template_slug, payload, status, sent_at, created_at
     FROM notification_queue WHERE recipient_user_id = $1 AND channel = 'in_app' AND status = 'sent' ORDER BY created_at DESC LIMIT 50`,
    [principal!.id],
  );
  return Response.json({ notifications: notifications.rows });
}
