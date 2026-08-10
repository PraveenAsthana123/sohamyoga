import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [contacts, leads, conv, clv, churn, sources] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM customer`),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM campaign_lead WHERE funnel_stage NOT IN ('converted','disqualified')`),
    query<{ total: string; converted: string }>(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE funnel_stage = 'converted') AS converted
       FROM campaign_lead WHERE created_at >= now() - interval '90 days'`,
    ),
    query<{ avg: string | null }>(`SELECT AVG(lifetime_spend_cad) AS avg FROM customer WHERE lifetime_spend_cad > 0`),
    query<{ count: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE risk_level IN ('high','critical')) AS count, COUNT(*) AS total FROM churn_prediction`,
    ),
    query<{ source_platform: string | null; count: string }>(
      `SELECT source_platform, COUNT(*) AS count FROM campaign_lead
       WHERE created_at >= now() - interval '30 days' GROUP BY source_platform ORDER BY count DESC`,
    ),
  ]);

  const convTotal = Number(conv.rows[0]?.total ?? 0);
  const convDone = Number(conv.rows[0]?.converted ?? 0);
  const sourceTotal = sources.rows.reduce((sum, r) => sum + Number(r.count), 0);

  return Response.json({
    totalContacts: Number(contacts.rows[0]?.count ?? 0),
    activeLeads: Number(leads.rows[0]?.count ?? 0),
    conversionRatePct: convTotal ? Math.round((convDone / convTotal) * 100) : 0,
    avgClv: clv.rows[0]?.avg ? Math.round(Number(clv.rows[0].avg)) : 0,
    churnRatePct: churn.rows[0]?.total && Number(churn.rows[0].total) > 0
      ? Math.round((Number(churn.rows[0].count) / Number(churn.rows[0].total)) * 1000) / 10 : 0,
    leadSources: sources.rows.map(r => ({
      source: r.source_platform ?? 'unknown', count: Number(r.count),
      pct: sourceTotal ? Math.round((Number(r.count) / sourceTotal) * 100) : 0,
    })),
  });
}
