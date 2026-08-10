// GET /api/ads/health-findings — CampaignHealthAuditJob output, for the Ads
// admin Health tab. Defaults to open findings; ?status=all|open|acknowledged|resolved.

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = new Set(['open', 'acknowledged', 'resolved']);

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const statusParam = req.nextUrl.searchParams.get('status') || 'open';
  const rows = await query<{
    id: string; campaign_id: string; campaign_name: string; finding_key: string; severity: string;
    summary: string; recommended_action: string; facts: Record<string, unknown>; status: string;
    created_at: string; resolved_at: string | null;
  }>(
    statusParam === 'all'
      ? `SELECT f.id, f.campaign_id, c.name AS campaign_name, f.finding_key, f.severity::text, f.summary,
                f.recommended_action, f.facts, f.status::text, f.created_at, f.resolved_at
         FROM ad_campaign_health_finding f JOIN ad_campaign c ON c.id = f.campaign_id
         ORDER BY f.created_at DESC LIMIT 200`
      : `SELECT f.id, f.campaign_id, c.name AS campaign_name, f.finding_key, f.severity::text, f.summary,
                f.recommended_action, f.facts, f.status::text, f.created_at, f.resolved_at
         FROM ad_campaign_health_finding f JOIN ad_campaign c ON c.id = f.campaign_id
         WHERE f.status = $1 ORDER BY
           CASE f.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, f.created_at DESC LIMIT 200`,
    statusParam === 'all' ? [] : [STATUSES.has(statusParam) ? statusParam : 'open'],
  );

  return Response.json({
    findings: rows.rows.map(r => ({
      id: r.id, campaignId: r.campaign_id, campaignName: r.campaign_name, findingKey: r.finding_key,
      severity: r.severity, summary: r.summary, recommendedAction: r.recommended_action, facts: r.facts,
      status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at ?? undefined,
    })),
  });
}
