import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'void'],
  sent: ['signed', 'void'],
  signed: [],
  void: [],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { status?: string; signedByName?: string } | null;
  if (!body?.status) return Response.json({ error: 'status is required.' }, { status: 400 });

  const current = await query<{ status: string }>(`SELECT status FROM contract WHERE id = $1`, [id]);
  if (!current.rowCount) return Response.json({ error: 'Contract not found.' }, { status: 404 });

  const allowed = TRANSITIONS[current.rows[0].status] ?? [];
  if (!allowed.includes(body.status)) {
    return Response.json({ error: `Cannot move a "${current.rows[0].status}" contract to "${body.status}".` }, { status: 409 });
  }
  if (body.status === 'signed' && !body.signedByName?.trim()) {
    return Response.json({ error: 'signedByName is required to mark a contract signed.' }, { status: 400 });
  }

  const timestampCol = body.status === 'sent' ? 'sent_at' : body.status === 'signed' ? 'signed_at' : body.status === 'void' ? 'voided_at' : null;
  await query(
    `UPDATE contract SET status = $2, updated_at = now(), signed_by_name = COALESCE($3, signed_by_name)${timestampCol ? `, ${timestampCol} = now()` : ''} WHERE id = $1`,
    [id, body.status, body.signedByName ?? null],
  );
  return Response.json({ ok: true });
}
