import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['open', 'acknowledged', 'fixed', 'false_positive'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json();
  if (!VALID_STATUSES.includes(body.status)) {
    return Response.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const { id } = await params;
  const resolved = body.status === 'fixed' || body.status === 'false_positive';
  const result = await query(
    `UPDATE security_finding SET status = $2,
       resolved_at = CASE WHEN $3 THEN now() ELSE NULL END,
       resolved_by = CASE WHEN $3 THEN $4 ELSE NULL END
     WHERE id = $1 RETURNING id`,
    [id, body.status, resolved, principal!.email ?? principal!.id],
  );
  if (!result.rowCount) return Response.json({ error: 'Finding not found.' }, { status: 404 });

  return Response.json({ updated: true });
}
