import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGES = ['new', 'contacted', 'trial', 'demo_scheduled', 'proposal', 'converted'];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{ funnel_stage: string; count: string }>(
    `SELECT funnel_stage, COUNT(*) AS count FROM campaign_lead
     WHERE created_at >= now() - interval '90 days' GROUP BY funnel_stage`,
  );
  const countByStage = Object.fromEntries(rows.rows.map(r => [r.funnel_stage, Number(r.count)]));
  const total = Object.values(countByStage).reduce((a, b) => a + b, 0);
  const converted = countByStage.converted ?? 0;

  const avgDealTime = await query<{ avg_days: string | null }>(
    `SELECT AVG(EXTRACT(DAY FROM converted_at - created_at)) AS avg_days
     FROM campaign_lead WHERE converted_at IS NOT NULL AND created_at >= now() - interval '180 days'`,
  );

  return Response.json({
    total,
    converted,
    conversionRatePct: total ? Math.round((converted / total) * 100) : 0,
    avgDealDays: avgDealTime.rows[0]?.avg_days ? Math.round(Number(avgDealTime.rows[0].avg_days)) : null,
    stages: STAGES.map(stage => ({ name: stage, count: countByStage[stage] ?? 0 })),
  });
}
