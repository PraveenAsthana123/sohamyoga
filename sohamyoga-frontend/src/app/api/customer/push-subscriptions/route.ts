import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Web Push subscription storage -- backs the browser's
// PushManager.subscribe() result (src/hooks/usePushNotifications.ts). No
// third-party push provider: this row is everything web-push's
// sendNotification() needs (src/lib/web-push.ts) to reach this exact
// browser/device via VAPID.
//
// tenant_id is resolved the same way /api/customer/preferences resolves it
// -- through the customer row for the logged-in principal, not through
// resolveStudent(), since a customer can grant notification permission
// before ever enrolling in a class.
async function resolveCustomerTenant(userId: string): Promise<string | null> {
  const result = await query<{ tenant_id: string }>(`SELECT tenant_id FROM customer WHERE user_id = $1`, [userId]);
  return result.rowCount ? result.rows[0].tenant_id : null;
}

export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } | null;
  if (!body?.endpoint?.trim() || !body.keys?.p256dh?.trim() || !body.keys?.auth?.trim()) {
    return Response.json({ error: 'endpoint and keys.p256dh/keys.auth are required.' }, { status: 400 });
  }

  const { principal } = await getCustomerPrincipal(req);
  const tenantId = await resolveCustomerTenant(principal!.id);
  if (!tenantId) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const userAgent = req.headers.get('user-agent') || null;
  const result = await query(
    `INSERT INTO push_subscription (tenant_id, user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tenant_id, endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent, last_seen_at = now()
     RETURNING id, endpoint, created_at`,
    [tenantId, principal!.id, body.endpoint.trim(), body.keys.p256dh.trim(), body.keys.auth.trim(), userAgent],
  );
  return Response.json({ subscription: result.rows[0] }, { status: 201 });
}

// Unsubscribe -- called with the same endpoint the browser's
// pushManager.getSubscription() returns, both when the user disables push
// from the UI and from pushsubscriptionchange cleanup.
export async function DELETE(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const endpoint = req.nextUrl.searchParams.get('endpoint');
  if (!endpoint) return Response.json({ error: 'endpoint query param is required.' }, { status: 400 });

  const { principal } = await getCustomerPrincipal(req);
  // Scoped to the caller's own user_id -- a customer can only remove their
  // own subscription rows, never another account's.
  const result = await query(
    `DELETE FROM push_subscription WHERE endpoint = $1 AND user_id = $2`,
    [endpoint, principal!.id],
  );
  if (!result.rowCount) return Response.json({ error: 'Subscription not found.' }, { status: 404 });
  return Response.json({ ok: true });
}

// List the caller's own active subscriptions -- used by the preferences UI
// to show a real "push is on for N device(s)" state instead of trusting
// client-side Notification.permission alone (permission can be 'granted'
// with the browser subscription revoked or the row never saved).
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const result = await query(
    `SELECT id, endpoint, user_agent, created_at, last_seen_at FROM push_subscription WHERE user_id = $1 ORDER BY created_at DESC`,
    [principal!.id],
  );
  return Response.json({ subscriptions: result.rows });
}
