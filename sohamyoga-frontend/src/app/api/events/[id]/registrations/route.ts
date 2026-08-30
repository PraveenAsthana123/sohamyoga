import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query(
    `SELECT id, name, email, phone, status::text, registered_at, checked_in_at
     FROM event_registration WHERE event_id = $1 ORDER BY registered_at DESC`,
    [params.id],
  );
  return Response.json({ registrations: rows.rows });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { registrationId?: string; action?: 'check_in' | 'no_show' | 'cancel' } | null;
  if (!body?.registrationId || !body.action || !['check_in', 'no_show', 'cancel'].includes(body.action)) {
    return Response.json({ error: 'registrationId and a valid action are required.' }, { status: 400 });
  }

  const statusMap = { check_in: 'attended', no_show: 'no_show', cancel: 'cancelled' } as const;
  const newStatus = statusMap[body.action];
  const timestampColumn = body.action === 'check_in' ? 'checked_in_at' : body.action === 'cancel' ? 'cancelled_at' : null;

  const result = await query(
    timestampColumn
      ? `UPDATE event_registration SET status = $2, ${timestampColumn} = now() WHERE id = $1 AND event_id = $3`
      : `UPDATE event_registration SET status = $2 WHERE id = $1 AND event_id = $3`,
    [body.registrationId, newStatus, params.id],
  );
  if (!result.rowCount) return Response.json({ error: 'Registration not found for this event.' }, { status: 404 });
  return Response.json({ ok: true, status: newStatus });
}
