import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { toCsv, csvResponse } from '@/lib/export-csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real CSV export of the points_ledger, keyed the same way /api/customer/
// journey reads it -- by identity user_id, not student_id.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const ledger = await query(
    `SELECT created_at::text AS created_at, amount, reason, balance_after FROM points_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500`,
    [principal!.id],
  );

  const csv = toCsv(ledger.rows as Record<string, unknown>[], [
    { key: 'created_at', header: 'Date' },
    { key: 'amount', header: 'Points' },
    { key: 'reason', header: 'Reason' },
    { key: 'balance_after', header: 'Balance After' },
  ]);
  return csvResponse(csv, 'sohamyoga-points-history.csv');
}
