import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  const { review_id, response_text } = await req.json() as { review_id: string; response_text: string };
  if (!review_id || !response_text?.trim()) {
    return Response.json({ error: 'review_id and response_text are required' }, { status: 400 });
  }

  await query(
    `UPDATE platform_review
     SET response_text=$1, responded_at=NOW(), responded_by=$2
     WHERE id=$3`,
    [response_text.trim(), principal?.email ?? 'admin', review_id]
  );
  return Response.json({ success: true, review_id });
}
