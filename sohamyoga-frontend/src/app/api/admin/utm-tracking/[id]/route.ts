import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Delete a single utm_link row. See ../route.ts for context. Links are not
 * editable after creation (source/medium/campaign are meant to be stable
 * once a tagged link has been distributed) -- only create and delete. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const result = await query(`DELETE FROM utm_link WHERE id = $1`, [id]);
  if (!result.rowCount) return Response.json({ error: 'UTM link not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
