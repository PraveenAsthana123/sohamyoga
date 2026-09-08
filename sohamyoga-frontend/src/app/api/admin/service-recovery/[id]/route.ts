import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRANSITIONS: Record<string, string[]> = {
  identified: ['contacted'],
  contacted: ['resolved', 'unresolved'],
  resolved: [],
  unresolved: ['contacted'],
};
const CONTACT_METHODS = ['phone', 'email', 'in_person'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { status?: string; contactMethod?: string; notes?: string } | null;
  if (!body?.status) return Response.json({ error: 'status is required.' }, { status: 400 });
  if (body.contactMethod && !CONTACT_METHODS.includes(body.contactMethod)) {
    return Response.json({ error: `contactMethod must be one of: ${CONTACT_METHODS.join(', ')}` }, { status: 400 });
  }

  const current = await query<{ status: string }>(`SELECT status FROM service_recovery_case WHERE id = $1`, [id]);
  if (!current.rowCount) return Response.json({ error: 'Recovery case not found.' }, { status: 404 });

  const allowed = TRANSITIONS[current.rows[0].status] ?? [];
  if (!allowed.includes(body.status)) {
    return Response.json({ error: `Cannot move a "${current.rows[0].status}" case to "${body.status}".` }, { status: 409 });
  }

  const isResolved = body.status === 'resolved';
  await query(
    `UPDATE service_recovery_case
     SET status = $2, contact_method = COALESCE($3, contact_method), notes = COALESCE($4, notes),
         updated_at = now()${isResolved ? ', resolved_at = now()' : ''}
     WHERE id = $1`,
    [id, body.status, body.contactMethod ?? null, body.notes ?? null],
  );
  return Response.json({ ok: true });
}
