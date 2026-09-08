import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Violation Management -- previously compliance_status/
// compliance_violations were written automatically by CampaignAdaptationJob
// and MarketingAutomationJob (BrandComplianceChecker), but no screen ever
// listed what got flagged across campaigns -- only a one-off manual paste
// tester (check-compliance) and a per-request review tool existed.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; platform: string; adapted_content: string; compliance_violations: string[];
    compliance_checked_at: string; status: string; brief_name: string | null;
  }>(
    `SELECT cv.id, cv.platform, cv.adapted_content, cv.compliance_violations, cv.compliance_checked_at, cv.status,
            cb.name AS brief_name
     FROM content_variant cv LEFT JOIN campaign_brief cb ON cb.id = cv.brief_id
     WHERE cv.compliance_status = 'flagged'
     ORDER BY cv.compliance_checked_at DESC`,
  );

  return Response.json({
    violations: rows.rows.map(r => ({
      id: r.id, platform: r.platform, adaptedContent: r.adapted_content, violations: r.compliance_violations,
      checkedAt: r.compliance_checked_at, status: r.status, briefName: r.brief_name,
    })),
  });
}
