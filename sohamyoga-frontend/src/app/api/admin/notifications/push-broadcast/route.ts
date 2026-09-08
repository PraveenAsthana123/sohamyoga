import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { sendPushToUser, pushConfigured } from '@/lib/web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real admin compose/broadcast for Web Push -- sends directly via
// sendPushToUser() against real push_subscription rows (VAPID, no 3rd-party
// provider). Two targets: a single user_id, or every distinct subscribed
// user in the tenant ("all"). Every send/removal/failure count returned is
// real -- if VAPID isn't configured or nobody is subscribed, that's exactly
// what the response says, never rounded up to a fabricated success.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  if (!pushConfigured()) return Response.json({ error: 'VAPID keys are not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT).' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    title?: string; body?: string; url?: string; target?: 'all' | 'user'; userId?: string;
  } | null;
  if (!body?.title?.trim() || !body.body?.trim()) {
    return Response.json({ error: 'title and body are required.' }, { status: 400 });
  }
  if (body.target === 'user' && !body.userId?.trim()) {
    return Response.json({ error: 'userId is required when target is "user".' }, { status: 400 });
  }

  const payload = { title: body.title.trim(), body: body.body.trim(), url: body.url?.trim() || undefined };

  const userIds = body.target === 'user'
    ? [body.userId!.trim()]
    : (await query<{ user_id: string }>(`SELECT DISTINCT user_id FROM push_subscription`)).rows.map(r => r.user_id);

  if (userIds.length === 0) {
    return Response.json({ sent: 0, removed: 0, failed: 0, recipients: 0, note: 'No push_subscription rows exist yet -- nobody has enabled push.' });
  }

  let sent = 0, removed = 0, failed = 0;
  for (const userId of userIds) {
    const r = await sendPushToUser(userId, payload);
    sent += r.sent; removed += r.removed; failed += r.failed;
  }

  return Response.json({ sent, removed, failed, recipients: userIds.length });
}
