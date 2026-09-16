import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  const rows = await query(
    `SELECT r.*, ps.scenario_name
     FROM platform_scenario_run r
     LEFT JOIN platform_scenario ps ON ps.id = r.scenario_id
     WHERE r.status='pending_approval'
     ORDER BY r.created_at ASC`
  );
  return Response.json({ runs: rows.rows });
}
