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

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform') || '';
  const feature_type = searchParams.get('feature_type') || '';

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (platform) { conditions.push(`platform = $${params.length + 1}`); params.push(platform); }
  if (feature_type) { conditions.push(`feature_type = $${params.length + 1}`); params.push(feature_type); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query(`SELECT * FROM platform_scenario ${where} ORDER BY platform, feature_type, scenario_name`, params);
  return Response.json({ scenarios: rows.rows, total: rows.rowCount });
}
