import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { startOperation, finishOperation, recordEvent, recordModelInvocation } from '@/lib/operation-ledger';
import { ollama, OLLAMA_MODELS } from '@/cron/OllamaClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = `You are a social media engagement advisor. Given real, measured account
performance data for one platform, recommend one concrete next action in 1-2 sentences.
Never invent statistics, dates, or facts not given to you. If the data is too sparse to
recommend anything specific, say so honestly.`;

// Real single-agent engagement-advisor loop: plan -> search (reuse real
// dashboard KPIs) -> act (local Ollama drafts a recommendation) -> execute
// (advisory only, no auto-posting) -> complete. Logged via the real
// operation-ledger (operation_run/operation_event/model_invocation), same
// infra every other cron job in this codebase already uses.
export async function POST(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { platform } = await params;
  const { principal } = await getAdminPrincipal(req);
  const tenantId = await getPrimaryTenantId();

  const run = await startOperation({
    componentKey: 'soham-social', operationType: 'agentic', operationName: 'platform_engagement_advisor',
    tenantId, correlationId: platform, actorType: 'admin', actorId: principal?.id, source: 'admin_ui',
    requestSummary: `Engagement recommendation for ${platform}`,
  });

  try {
    await recordEvent(run, 'AGENT_PLAN', { stage: 'plan', message: `Planning engagement recommendation for ${platform}`, tenantId });

    const [accounts, posts, viral, engagement] = await Promise.all([
      query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM social_account WHERE platform = $1 AND status = 'active'`, [platform]),
      query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM social_post WHERE platform = $1 AND status = 'published'`, [platform]),
      query<{ n: string }>(`SELECT COUNT(DISTINCT post_id)::text AS n FROM viral_signal WHERE platform = $1 AND is_viral = true AND tenant_id = $2`, [platform, tenantId]),
      query<{ avg_clicks: string | null; avg_impressions: string | null }>(
        `SELECT avg(spa.clicks)::text AS avg_clicks, avg(spa.impressions)::text AS avg_impressions
         FROM social_post_analytics spa JOIN social_post sp ON sp.id = spa.post_id WHERE sp.platform = $1`,
        [platform],
      ),
    ]);
    const kpis = {
      connectedAccounts: Number(accounts.rows[0].n), publishedPosts: Number(posts.rows[0].n),
      viralPosts: Number(viral.rows[0].n),
      avgClicksPerPost: engagement.rows[0].avg_clicks ? Math.round(Number(engagement.rows[0].avg_clicks) * 10) / 10 : 0,
      avgImpressionsPerPost: engagement.rows[0].avg_impressions ? Math.round(Number(engagement.rows[0].avg_impressions)) : 0,
    };
    await recordEvent(run, 'AGENT_SEARCH', { stage: 'search', message: `Real KPIs: ${JSON.stringify(kpis)}`, tenantId });

    const prompt = `Platform: ${platform}. Connected accounts: ${kpis.connectedAccounts}. Published posts: ${kpis.publishedPosts}. Viral posts (30d): ${kpis.viralPosts}. Avg clicks/post: ${kpis.avgClicksPerPost}. Avg impressions/post: ${kpis.avgImpressionsPerPost}. Recommend one concrete next action.`;
    const modelStart = Date.now();
    const recommendation = await ollama.chat(
      [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
      { tier: 'strong', timeoutMs: 60_000 },
    );
    await recordModelInvocation(run, OLLAMA_MODELS.strong, { status: 'succeeded', purpose: 'engagement_recommendation', promptChars: prompt.length, outputChars: recommendation.length, latencyMs: Date.now() - modelStart });
    await recordEvent(run, 'AGENT_ACT', { stage: 'act', message: 'Recommendation drafted', tenantId });
    await recordEvent(run, 'AGENT_EXECUTE', { stage: 'execute', message: 'Advisory only -- no auto-posting or account changes made', tenantId });
    await recordEvent(run, 'AGENT_COMPLETE', { stage: 'complete', message: 'Run complete', tenantId });
    await finishOperation(run, 'succeeded', { kpis, recommendation });

    return Response.json({ runId: run.id, platform, kpis, recommendation });
  } catch (err) {
    await recordModelInvocation(run, OLLAMA_MODELS.strong, { status: 'failed', purpose: 'engagement_recommendation' });
    await finishOperation(run, 'failed', { error: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
