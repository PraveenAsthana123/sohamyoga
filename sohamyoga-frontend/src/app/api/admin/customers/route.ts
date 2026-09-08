import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Minimal real customer list, for admin picker dropdowns (billing, support
// tickets). No such list existed before -- customer-360 only supports
// lookup-by-known-email, not browsing.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const customers = await query(
    `SELECT id, display_name, email FROM customer ORDER BY display_name LIMIT 500`,
  );
  return Response.json({ customers: customers.rows });
}
