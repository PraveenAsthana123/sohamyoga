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
    `SELECT id, data, consent_given, lead_id, created_at FROM form_submission WHERE form_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [params.id],
  );
  return Response.json({ submissions: rows.rows });
}
