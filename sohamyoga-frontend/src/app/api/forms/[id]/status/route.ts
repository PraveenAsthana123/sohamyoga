import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: 'activate' | 'archive' } | null;
  if (body?.action !== 'activate' && body?.action !== 'archive') return Response.json({ error: 'action must be "activate" or "archive".' }, { status: 400 });

  const status = body.action === 'activate' ? 'active' : 'archived';
  const result = await query(`UPDATE form_definition SET status = $2, updated_at = now() WHERE id = $1`, [params.id, status]);
  if (!result.rowCount) return Response.json({ error: 'Form not found.' }, { status: 404 });
  return Response.json({ ok: true, status });
}
