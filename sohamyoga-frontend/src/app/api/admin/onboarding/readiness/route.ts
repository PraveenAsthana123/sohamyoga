import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { computeBusinessReadiness } from '@/domain/onboarding/BusinessReadinessScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Business Readiness Score -- first build. Same deterministic
// completeness-rubric pattern as BrandHealthScore, but for tenant onboarding
// as a whole: business profile, brand kit, locations, catalog, channels,
// owner. Every input is a real row/field count, never fabricated.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const [profile, brandKit, branches, products, channels, tenant] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM marketing_business_profile WHERE tenant_id = $1`, [tenantId]),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM brand_kit WHERE tenant_id = $1 AND is_default = true`, [tenantId]),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM branch WHERE tenant_id = $1`, [tenantId]),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM product_master WHERE status != 'archived'`, []),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM tenant_channel_config WHERE tenant_id = $1 AND enabled = true`, [tenantId]),
    query<{ owner_user_id: string | null }>(`SELECT owner_user_id FROM tenant WHERE id = $1`, [tenantId]),
  ]);

  const result = computeBusinessReadiness({
    hasBusinessProfile: Number(profile.rows[0]?.count ?? 0) > 0,
    hasBrandKit: Number(brandKit.rows[0]?.count ?? 0) > 0,
    branchCount: Number(branches.rows[0]?.count ?? 0),
    productCount: Number(products.rows[0]?.count ?? 0),
    connectedChannelCount: Number(channels.rows[0]?.count ?? 0),
    hasOwner: Boolean(tenant.rows[0]?.owner_user_id),
  });

  return Response.json(result);
}
