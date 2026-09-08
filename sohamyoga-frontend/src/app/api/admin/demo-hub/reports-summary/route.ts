import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Aggregates the five real report sources this platform's cron jobs already
 * produce (Voice of Customer, campaign health findings, NPS, churn
 * predictions, SEO) into compact summary cards for the Demo Hub's Reports
 * tab. Every source already has its own detail page (linked here) — this
 * route does not duplicate their logic, it reads the same underlying tables
 * to build a one-screen overview. SEO is reported honestly as blocked when
 * seo_report is empty, since SeoReportJob depends on a Matomo deployment
 * that does not exist in this environment — no fabricated report is shown.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [voc, health, nps, churn, seo, competitor] = await Promise.all([
    query<{ id: string; period_end: string; source_message_count: number; overall_summary: string; themes: unknown }>(
      `SELECT id, period_end, source_message_count, overall_summary, themes FROM voice_of_customer_digest ORDER BY period_start DESC LIMIT 1`,
    ),
    query<{ severity: string; count: string }>(
      `SELECT severity::text, COUNT(*) AS count FROM ad_campaign_health_finding WHERE status = 'open' GROUP BY severity`,
    ),
    query<{ nps_score: string | null; total_responses: string | null }>(
      `SELECT sa.nps_score, sa.total_responses FROM survey s JOIN survey_analytics sa ON sa.survey_id = s.id WHERE s.type = 'nps' ORDER BY sa.nps_score DESC NULLS LAST LIMIT 1`,
    ),
    query<{ total: string; risky: string }>(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE risk_level IN ('high','critical')) AS risky FROM churn_prediction`,
    ),
    query<{ count: string; latest_status: string | null }>(
      `SELECT COUNT(*) AS count, (SELECT status FROM seo_report ORDER BY report_date DESC LIMIT 1) AS latest_status FROM seo_report`,
    ),
    query<{ competitors: string; price_points: string }>(
      `SELECT (SELECT COUNT(*) FROM competitor)::text AS competitors, COUNT(*)::text AS price_points FROM competitor_price_point`,
    ),
  ]);

  return Response.json({
    voiceOfCustomer: voc.rowCount
      ? { ...voc.rows[0], hasData: true }
      : { hasData: false, reason: 'No digest yet — run "voice-of-customer" from the Use Case Catalog once real customer messages exist.' },
    campaignHealth: {
      hasData: (health.rowCount ?? 0) > 0,
      openBySeverity: Object.fromEntries(health.rows.map(r => [r.severity, Number(r.count)])),
      reason: health.rowCount ? undefined : 'No open findings — run "campaign-health-audit" against an active campaign.',
    },
    nps: nps.rowCount && nps.rows[0].nps_score !== null
      ? { hasData: true, score: Number(nps.rows[0].nps_score), totalResponses: Number(nps.rows[0].total_responses) }
      : { hasData: false, reason: 'No computed NPS yet — run "nps-calculation" once survey responses exist.' },
    churn: {
      hasData: Number(churn.rows[0]?.total ?? 0) > 0,
      total: Number(churn.rows[0]?.total ?? 0),
      flagged: Number(churn.rows[0]?.risky ?? 0),
      reason: Number(churn.rows[0]?.total ?? 0) ? undefined : 'No predictions yet — run "churn-prediction" against active enrollments.',
    },
    seo: {
      hasData: Number(seo.rows[0]?.count ?? 0) > 0,
      status: seo.rows[0]?.latest_status ?? null,
      blocked: 'Blocked on your side: SeoReportJob reads real analytics from Matomo, which is not deployed in this environment. Deploy Matomo and set MATOMO_BASE_URL/MATOMO_SITE_ID/MATOMO_AUTH_TOKEN to unblock — this report will not fabricate SEO data without it.',
    },
    competitorIntelligence: {
      hasData: Number(competitor.rows[0]?.price_points ?? 0) > 0,
      competitors: Number(competitor.rows[0]?.competitors ?? 0),
      pricePoints: Number(competitor.rows[0]?.price_points ?? 0),
      reason: Number(competitor.rows[0]?.price_points ?? 0) ? undefined : 'No competitor price points recorded yet — add one at /admin/competitors (admin-researched only, never scraped).',
    },
  });
}
