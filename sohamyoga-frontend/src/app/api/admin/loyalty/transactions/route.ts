import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Main Loyalty Dashboard -- loyalty_transaction had a real write path
// (booking check-in earn trigger) but no admin view existed anywhere to
// see the resulting ledger across customers.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string; email: string; amount: number; balance_after: number; reason: string; created_at: string }>(
    `SELECT lt.id, c.email, lt.amount, lt.balance_after, lt.reason, lt.created_at
     FROM loyalty_transaction lt JOIN customer c ON c.id = lt.customer_id
     WHERE lt.tenant_id = $1 ORDER BY lt.created_at DESC LIMIT 100`,
    [tenantId],
  );
  return Response.json({
    transactions: result.rows.map((r) => ({
      id: r.id, customerEmail: r.email, amount: r.amount, balanceAfter: r.balance_after, reason: r.reason, createdAt: r.created_at,
    })),
  });
}
