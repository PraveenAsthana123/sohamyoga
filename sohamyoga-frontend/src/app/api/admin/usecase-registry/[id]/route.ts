import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['real', 'partial', 'not_built', 'blocked', 'n_a'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json();
  if (!VALID_STATUSES.includes(body.status)) {
    return Response.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }
  if (!body.evidence?.trim()) {
    return Response.json({ error: 'evidence is required when changing status -- never mark a use case real/partial without a citation.' }, { status: 400 });
  }

  const { id } = await params;
  const result = await query(
    `UPDATE use_case_registry SET status = $2, evidence = $3, updated_at = now() WHERE id = $1 RETURNING id`,
    [id, body.status, body.evidence],
  );
  if (!result.rowCount) return Response.json({ error: 'Use case not found.' }, { status: 404 });

  return Response.json({ updated: true });
}
