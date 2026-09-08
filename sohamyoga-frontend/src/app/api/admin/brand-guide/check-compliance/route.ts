import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { checkBrandCompliance } from '@/domain/branding/BrandComplianceChecker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manual compliance test tool for admins -- paste any draft copy, see
// whether it trips the real brand_kit banned_phrases before it ever
// reaches CampaignAdaptationJob's automatic check.
export async function POST(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;

  const body = await req.json();
  if (!body.text?.trim()) return Response.json({ error: 'text is required.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const kit = await query<{ banned_phrases: string[]; approved_phrases: string[]; tone_words: string[] }>(
    `SELECT banned_phrases, approved_phrases, tone_words FROM brand_kit WHERE tenant_id = $1 AND is_default = true LIMIT 1`,
    [tenantId],
  );
  if (!kit.rowCount) {
    return Response.json({ error: 'No default brand kit exists yet -- create one at /admin/brand-kits first.' }, { status: 404 });
  }

  const result = checkBrandCompliance(body.text, kit.rows[0]);
  return Response.json(result);
}
