import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; keywordId: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id, keywordId } = await params;
  const result = await query(`DELETE FROM ad_keyword WHERE id = $1 AND ad_group_id = $2`, [keywordId, id]);
  if (!result.rowCount) return Response.json({ error: 'Keyword not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
