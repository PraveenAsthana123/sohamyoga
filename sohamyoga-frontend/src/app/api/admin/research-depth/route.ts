import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { computeResearchTier } from '@/domain/marketing/ResearchDepthRouter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real, free pre-filter over real active leads -- shows which ones
// would warrant a real costed Ollama call (LeadNurturingJob, #6) vs.
// which can be skipped or handled with a free quick_scan.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  const rows = await query<{ id: string; email: string | null; phone: string | null; funnel_stage: string; days: number }>(
    `SELECT id, email, phone, funnel_stage, EXTRACT(DAY FROM now() - created_at)::int AS days FROM campaign_lead WHERE tenant_id = $1`,
    [tenantId],
  );
  const routed = rows.rows.map((r) => ({
    id: r.id,
    tier: computeResearchTier({ hasEmail: !!r.email, hasPhone: !!r.phone, daysSinceCapture: r.days, funnelStage: r.funnel_stage }),
  }));
  const summary = { skip: 0, quick_scan: 0, ai_diagnostic: 0 } as Record<string, number>;
  for (const r of routed) summary[r.tier]++;
  return Response.json({ summary, routed });
}
