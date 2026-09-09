import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { startOperation, finishOperation, recordEvent } from '@/lib/operation-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real deterministic pipeline: recomputes this platform's trending
// hashtags from its own real viral_signal-flagged posts (the same query
// TrendDiscovery.ts uses tenant-wide, scoped here to one platform) -- no
// LLM call, fully deterministic, logged as a real operation_run.
export async function POST(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { platform } = await params;
  const { principal } = await getAdminPrincipal(req);
  const tenantId = await getPrimaryTenantId();

  const run = await startOperation({
    componentKey: 'soham-social', operationType: 'pipeline', operationName: 'platform_trending_hashtags',
    tenantId, correlationId: platform, actorType: 'admin', actorId: principal?.id, source: 'admin_ui',
    requestSummary: `Recompute trending hashtags for ${platform}`,
  });
  await recordEvent(run, 'PIPELINE_STAGE', { stage: 'query', message: `Querying viral_signal for platform=${platform}`, tenantId });

  try {
    const result = await query<{ hashtag: string; post_count: string; avg_score: string }>(
      `SELECT unnest(v.hashtags) AS hashtag, count(DISTINCT vs.post_id)::text AS post_count, avg(vs.viral_score)::text AS avg_score
       FROM viral_signal vs
       JOIN social_post sp ON sp.id = vs.post_id
       JOIN social_platform_variant v ON v.draft_id = sp.draft_id AND v.platform = sp.platform
       WHERE vs.tenant_id = $1 AND vs.platform = $2 AND vs.is_viral = true
       GROUP BY unnest(v.hashtags)
       ORDER BY post_count DESC, avg_score DESC
       LIMIT 20`,
      [tenantId, platform],
    );
    const hashtags = result.rows.map((r) => ({ hashtag: r.hashtag, viralPostCount: Number(r.post_count), avgViralScore: Math.round(Number(r.avg_score) * 10) / 10 }));

    await recordEvent(run, 'PIPELINE_COMPLETE', { stage: 'complete', message: `Found ${hashtags.length} trending hashtag(s)`, tenantId });
    await finishOperation(run, 'succeeded', { hashtagCount: hashtags.length });

    return Response.json({ runId: run.id, platform, hashtags });
  } catch (err) {
    await finishOperation(run, 'failed', { error: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
