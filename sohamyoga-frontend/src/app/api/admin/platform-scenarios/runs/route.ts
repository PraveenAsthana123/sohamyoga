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
  const actor_type = sp.get('actor_type') ?? '';
  const status = sp.get('status') ?? '';

  const conditions: string[] = [];
  const vals: unknown[] = [];
  if (platform) { conditions.push(`r.platform=$${vals.length+1}`); vals.push(platform); }
  if (actor_type) { conditions.push(`r.actor_type=$${vals.length+1}`); vals.push(actor_type); }
  if (status) { conditions.push(`r.status=$${vals.length+1}`); vals.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query(
    `SELECT r.*, ps.scenario_name
     FROM platform_scenario_run r
     LEFT JOIN platform_scenario ps ON ps.id = r.scenario_id
     ${where}
     ORDER BY r.created_at DESC LIMIT 200`,
    vals
  );
  return Response.json({ runs: rows.rows });
}
