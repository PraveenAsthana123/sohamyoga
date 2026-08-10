import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/ecommerce/abandoned-carts/:id — { action: 'sent' | 'dismissed' }
// 'sent' means a human copied/sent the message manually — no email is
// dispatched by this endpoint, matching the draft-only pattern used
// throughout this app for anything customer-facing.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: string } | null;
  if (body?.action !== 'sent' && body?.action !== 'dismissed') {
    return Response.json({ error: "action must be 'sent' or 'dismissed'" }, { status: 400 });
  }

  const result = await query(
    `UPDATE abandoned_cart_recovery SET status = $1, sent_at = CASE WHEN $1 = 'sent' THEN now() ELSE sent_at END
     WHERE id = $2 RETURNING id`,
    [body.action, params.id],
  );
  if (!result.rows.length) return Response.json({ error: 'Draft not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
