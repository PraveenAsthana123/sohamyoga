import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real per-platform KPI dashboard -- every number here is a real query
// against social_account/social_post/viral_signal/sentiment_log/
// social_post_analytics filtered by platform, never a placeholder.
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { platform } = await params;
  const tenantId = await getPrimaryTenantId();

  const [accounts, posts, viral, sentiment, engagement, operationRuns] = await Promise.all([
    query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM social_account WHERE platform = $1 AND status = 'active'`, [platform]),
    query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM social_post WHERE platform = $1 AND status = 'published'`, [platform]),
    query<{ n: string }>(`SELECT COUNT(DISTINCT post_id)::text AS n FROM viral_signal WHERE platform = $1 AND is_viral = true AND tenant_id = $2`, [platform, tenantId]),
    query<{ sentiment: string; n: string }>(
      `SELECT sentiment, count(*)::text AS n FROM sentiment_log WHERE platform = $1 AND created_at >= now() - interval '30 days' GROUP BY sentiment`,
      [platform],
    ),
    query<{ avg_clicks: string | null; avg_impressions: string | null; total_conversions: string | null }>(
      `SELECT avg(spa.clicks)::text AS avg_clicks, avg(spa.impressions)::text AS avg_impressions, sum(spa.conversions)::text AS total_conversions
       FROM social_post_analytics spa JOIN social_post sp ON sp.id = spa.post_id WHERE sp.platform = $1`,
      [platform],
    ),
    query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM operation_run WHERE correlation_id = $1`, [platform]),
  ]);

  const sentimentMap: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
  for (const row of sentiment.rows) sentimentMap[row.sentiment] = Number(row.n);

  return Response.json({
    platform,
    kpis: {
      connectedAccounts: Number(accounts.rows[0].n),
      publishedPosts: Number(posts.rows[0].n),
      viralPosts30d: Number(viral.rows[0].n),
      avgClicksPerPost: engagement.rows[0].avg_clicks ? Math.round(Number(engagement.rows[0].avg_clicks) * 10) / 10 : 0,
      avgImpressionsPerPost: engagement.rows[0].avg_impressions ? Math.round(Number(engagement.rows[0].avg_impressions)) : 0,
      totalConversions: Number(engagement.rows[0].total_conversions || 0),
      totalOperationRuns: Number(operationRuns.rows[0].n),
    },
    sentiment30d: sentimentMap,
  });
}
