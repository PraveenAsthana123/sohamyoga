import { NextRequest } from 'next/server';
import { getCustomerPrincipal } from '@/lib/customer-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getCustomerPrincipal(req);
  if (auth.denied) return auth.denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const customerEmail = auth.principal?.email;
  if (!customerEmail) return Response.json({ error: 'Authentication required.' }, { status: 401 });

  const partnerResult = await query(
    `SELECT id FROM affiliate_partner WHERE email = $1 LIMIT 1`,
    [customerEmail]
  );

  if (!partnerResult.rowCount) {
    return Response.json({ earnings: [], total_earned: 0, total_paid: 0, outstanding: 0 });
  }

  const partnerId = partnerResult.rows[0].id;

  const [earnings, summary] = await Promise.all([
    query(`
      SELECT ac.*, o.order_number
      FROM affiliate_conversion ac
      LEFT JOIN sales_order o ON o.id = ac.order_id
      WHERE ac.vendor_id = $1
      ORDER BY ac.created_at DESC
      LIMIT 200
    `, [partnerId]).catch(() => ({ rows: [] })),

    query(`
      SELECT
        COALESCE(SUM(total_earned), 0) AS total_earned,
        COALESCE(SUM(total_paid), 0) AS total_paid,
        COALESCE(SUM(total_earned - total_paid), 0) AS outstanding
      FROM affiliate_partner WHERE id = $1
    `, [partnerId]),
  ]);

  return Response.json({
    earnings: earnings.rows,
    total_earned: Number(summary.rows[0]?.total_earned ?? 0),
    total_paid: Number(summary.rows[0]?.total_paid ?? 0),
    outstanding: Number(summary.rows[0]?.outstanding ?? 0),
  });
}
