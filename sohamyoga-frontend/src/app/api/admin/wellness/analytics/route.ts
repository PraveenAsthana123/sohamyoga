import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real aggregates from the 3 views db-schema.sql already defines
// (v_wellness_summary, v_daily_completeness, v_bmi_distribution) --
// nothing ever queried them before this route (found live 2026-09-01).
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();

  const [kpis, conditions, fitnessLevels, bmiDistribution, completenessToday, wearablesConnected] = await Promise.all([
    query<{ profile_count: string; avg_bmi: string | null; doctor_clearance_count: string; pregnancy_count: string }>(
      `SELECT COUNT(*) AS profile_count,
              ROUND(AVG(bmi), 1) AS avg_bmi,
              COUNT(*) FILTER (WHERE doctor_clearance) AS doctor_clearance_count,
              COUNT(*) FILTER (WHERE pregnancy_mode) AS pregnancy_count
       FROM v_wellness_summary WHERE tenant_id = $1`,
      [tenantId],
    ),
    query(
      `SELECT condition, COUNT(*) AS count FROM (
         SELECT unnest(conditions) AS condition FROM health_profile WHERE tenant_id = $1
       ) c GROUP BY condition ORDER BY count DESC`,
      [tenantId],
    ),
    query(
      `SELECT fitness_level, COUNT(*) AS count FROM health_profile WHERE tenant_id = $1 GROUP BY fitness_level ORDER BY count DESC`,
      [tenantId],
    ),
    query(`SELECT * FROM v_bmi_distribution WHERE tenant_id = $1`, [tenantId]),
    query(
      `SELECT * FROM v_daily_completeness WHERE tenant_id = $1 AND date = CURRENT_DATE`,
      [tenantId],
    ),
    query<{ platform: string; connected_count: string }>(
      `SELECT platform, COUNT(*) AS connected_count FROM wearable_sync WHERE tenant_id = $1 AND status = 'connected' GROUP BY platform`,
      [tenantId],
    ),
  ]);

  return Response.json({
    kpis: kpis.rows[0] ?? { profile_count: '0', avg_bmi: null, doctor_clearance_count: '0', pregnancy_count: '0' },
    conditionBreakdown: conditions.rows,
    fitnessLevels: fitnessLevels.rows,
    bmiDistribution: bmiDistribution.rows,
    completenessToday: completenessToday.rows[0] ?? null,
    wearablesConnected: wearablesConnected.rows,
  });
}
