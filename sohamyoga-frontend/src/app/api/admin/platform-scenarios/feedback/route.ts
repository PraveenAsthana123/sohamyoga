import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/platform-scenarios-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  await ensureSchema();

  const platform = new URL(req.url).searchParams.get('platform') ?? '';
  const rows = platform
    ? await query('SELECT * FROM platform_content_feedback WHERE platform=$1 ORDER BY fetched_at DESC LIMIT 200', [platform])
    : await query('SELECT * FROM platform_content_feedback ORDER BY fetched_at DESC LIMIT 200');
  return Response.json({ feedback: rows.rows });
}
