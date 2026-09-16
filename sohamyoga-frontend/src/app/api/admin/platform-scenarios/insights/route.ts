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

  const sp = new URL(req.url).searchParams;
  const platform = sp.get('platform') ?? '';
  const insight_type = sp.get('insight_type') ?? '';

  const conds: string[] = [];
  const vals: unknown[] = [];
  if (platform) { conds.push(`platform=$${vals.length+1}`); vals.push(platform); }
  if (insight_type) { conds.push(`insight_type=$${vals.length+1}`); vals.push(insight_type); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await query(`SELECT * FROM platform_insight ${where} ORDER BY created_at DESC LIMIT 100`, vals);
  return Response.json({ insights: rows.rows });
}
