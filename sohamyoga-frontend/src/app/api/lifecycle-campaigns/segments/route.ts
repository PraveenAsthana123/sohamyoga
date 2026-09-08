import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real audience segments -- the campaign wizard previously offered a
// hardcoded fake list ("Free Plan Users, 512 users") with no query behind
// it at all. These counts are computed fresh from subscription_master and
// campaign_lead every request.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const [active, trial, grace, leads] = await Promise.all([
    query<{ n: string }>(`SELECT count(*)::text AS n FROM subscription_master sm JOIN customer c ON c.id::text = sm.customer_id WHERE sm.status = 'active'`),
    query<{ n: string }>(`SELECT count(*)::text AS n FROM subscription_master sm JOIN customer c ON c.id::text = sm.customer_id WHERE sm.status = 'trial'`),
    query<{ n: string }>(`SELECT count(*)::text AS n FROM subscription_master sm JOIN customer c ON c.id::text = sm.customer_id WHERE sm.status = 'grace_period'`),
    query<{ n: string }>(`SELECT count(*)::text AS n FROM campaign_lead WHERE tenant_id = $1 AND created_at >= now() - interval '30 days'`, [tenantId]),
  ]);

  const segments = [
    { id: 'active_subscribers', name: 'Active Subscribers', size: Number(active.rows[0].n) },
    { id: 'trial_users', name: 'Trial Users', size: Number(trial.rows[0].n) },
    { id: 'grace_period', name: 'At-Risk (Grace Period)', size: Number(grace.rows[0].n) },
    { id: 'new_leads_30d', name: 'New Leads (30 days)', size: Number(leads.rows[0].n) },
  ];
  return Response.json({ segments });
}
