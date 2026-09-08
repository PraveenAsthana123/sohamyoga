import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Admin Portal -- Onboarding Management -- customer.onboarding_step/
// onboarding_completed_at were real, written columns (the real 4-step
// customer onboarding wizard) but no staff view existed anywhere to see
// who had completed onboarding vs who was stuck mid-flow.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const result = await query<{ email: string; onboarding_step: string | null; onboarding_completed_at: string | null; created_at: string }>(
    `SELECT email, onboarding_step, onboarding_completed_at, created_at FROM customer WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [tenantId],
  );
  const rows = result.rows.map((r) => ({
    email: r.email, step: r.onboarding_step ?? 'not_started', completedAt: r.onboarding_completed_at, createdAt: r.created_at,
  }));
  return Response.json({
    customers: rows,
    completedCount: rows.filter((r) => r.completedAt).length,
    totalCount: rows.length,
  });
}
