import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED']);

// PATCH /api/lifecycle-campaigns/:id — status transitions only (Launch/Pause buttons).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { status?: string } | null;
  if (!body?.status || !ALLOWED_STATUSES.has(body.status)) {
    return Response.json({ error: 'A valid status is required.' }, { status: 400 });
  }

  const result = await query(
    `UPDATE lifecycle_campaign SET status = $1, updated_at = now() WHERE id = $2 RETURNING id`,
    [body.status, params.id],
  );
  if (!result.rows.length) return Response.json({ error: 'Campaign not found.' }, { status: 404 });

  return Response.json({ ok: true });
}
