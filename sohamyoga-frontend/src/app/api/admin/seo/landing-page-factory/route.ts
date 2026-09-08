import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { generateLocalLandingPages } from '@/domain/seo/LocalLandingPageFactory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const profileResult = await query<{ business_name: string }>('SELECT business_name FROM marketing_business_profile WHERE tenant_id = $1', [tenantId]);
  const businessName = profileResult.rows[0]?.business_name ?? 'This business';

  const pages = await generateLocalLandingPages(tenantId, businessName);
  return Response.json({ pages });
}
