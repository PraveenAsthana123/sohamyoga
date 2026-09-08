import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Read-only, customer-safe view of which of the studio's own social accounts
// are genuinely live -- backed by the same account_provisioning_job/
// social_platform_requirement tables the real admin provisioning system
// uses. Replaces a previous version of this page that showed hardcoded fake
// "connected, 1,240 followers" data with no real backend behind it.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [requirements, activeJobs] = await Promise.all([
    query<{ platform: string; business_use: string | null; priority: string | null }>(
      `SELECT platform, business_use, priority FROM social_platform_requirement ORDER BY
         CASE priority WHEN 'red' THEN 0 WHEN 'orange' THEN 1 WHEN 'yellow' THEN 2 ELSE 3 END, platform`,
    ),
    query<{ platform: string; account_name: string; profile_url: string | null }>(
      `SELECT DISTINCT ON (platform) platform, account_name, profile_url
       FROM account_provisioning_job WHERE state = 'ACTIVE' ORDER BY platform, updated_at DESC`,
    ),
  ]);

  const activeByPlatform = new Map(activeJobs.rows.map(j => [j.platform, j]));
  const platforms = requirements.rows.map(r => {
    const active = activeByPlatform.get(r.platform);
    return {
      platform: r.platform,
      businessUse: r.business_use,
      connected: Boolean(active),
      accountName: active?.account_name ?? null,
      profileUrl: active?.profile_url ?? null,
    };
  });

  return Response.json({ platforms });
}
