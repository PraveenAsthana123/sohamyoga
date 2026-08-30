import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { staffResponse?: string } | null;
  if (!body?.staffResponse?.trim()) return Response.json({ error: 'staffResponse is required.' }, { status: 400 });

  const result = await query(
    `UPDATE service_review SET staff_response = $2, responded_at = now() WHERE id = $1 RETURNING id`,
    [params.id, body.staffResponse],
  );
  if (!result.rowCount) return Response.json({ error: 'Review not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
