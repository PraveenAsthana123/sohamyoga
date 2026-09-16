import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();

  const [profileStats, snapshots, wellnessStats] = await Promise.all([
    query<{
      total: string; active_this_week: string; pregnancy_count: string;
      senior_count: string; kids_count: string; doctor_cleared: string;
    }>(
      `SELECT
         count(*)::text AS total,
         count(*) FILTER (WHERE updated_at >= now() - interval '7 days')::text AS active_this_week,
         count(*) FILTER (WHERE pregnancy_mode = true)::text AS pregnancy_count,
         count(*) FILTER (WHERE senior_mode = true)::text AS senior_count,
         count(*) FILTER (WHERE kids_mode = true)::text AS kids_count,
         count(*) FILTER (WHERE doctor_clearance = true)::text AS doctor_cleared
       FROM health_profile WHERE tenant_id = $1`,
      [tenantId],
    ),
    query<{
      id: string; captured_at: string; revenue_last_24h: string;
      new_leads_last_24h: number; bookings_last_24h: number; db_reachable: boolean; db_query_ms: number | null;
    }>(
      `SELECT id, captured_at, revenue_last_24h, new_leads_last_24h, bookings_last_24h, db_reachable, db_query_ms
       FROM health_snapshot WHERE tenant_id = $1
       ORDER BY captured_at DESC LIMIT 50`,
      [tenantId],
    ),
    query<{ total: string; avg_score: string | null }>(
      `SELECT count(*)::text AS total,
              round(avg(score), 1)::text AS avg_score
       FROM wellness_audit WHERE profile_id IN (
         SELECT id FROM health_profile WHERE tenant_id = $1
       )`,
      [tenantId],
    ).catch(() => ({ rows: [{ total: '0', avg_score: null }] })),
  ]);

  const snapshotsToday = snapshots.rows.filter(s =>
    new Date(s.captured_at) >= new Date(new Date().toDateString())
  );

  const p = profileStats.rows[0];
  const w = wellnessStats.rows[0];

  return Response.json({
    profiles: {
      total: Number(p?.total ?? 0),
      activeThisWeek: Number(p?.active_this_week ?? 0),
      pregnancyMode: Number(p?.pregnancy_count ?? 0),
      seniorMode: Number(p?.senior_count ?? 0),
      kidsMode: Number(p?.kids_count ?? 0),
      doctorCleared: Number(p?.doctor_cleared ?? 0),
    },
    snapshots: snapshots.rows,
    snapshotsToday: snapshotsToday.length,
    wellness: {
      total: Number(w?.total ?? 0),
      avgScore: w?.avg_score ? Number(w.avg_score) : null,
    },
  });
}
