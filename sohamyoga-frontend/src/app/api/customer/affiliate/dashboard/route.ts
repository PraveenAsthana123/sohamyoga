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

  // Find affiliate partner record by email
  const partnerResult = await query(
    `SELECT * FROM affiliate_partner WHERE email = $1 LIMIT 1`,
    [customerEmail]
  );

  const partner = partnerResult.rows[0] ?? null;

  if (!partner) {
    return Response.json({ partner: null, is_affiliate: false });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Get this month's stats from referral_click and affiliate_conversion
  const [monthClicks, monthConversions, monthEarned, payouts, recentLinks] = await Promise.all([
    query(`
      SELECT COUNT(*) AS count
      FROM referral_click rc
      JOIN referral_code c ON c.id = rc.referral_code_id
      WHERE c.created_by = $1 AND rc.created_at >= $2
    `, [partner.id, monthStart]).catch(() => ({ rows: [{ count: 0 }] })),

    query(`
      SELECT COUNT(*) AS count
      FROM affiliate_conversion ac
      WHERE ac.vendor_id = $1 AND ac.created_at >= $2
    `, [partner.id, monthStart]).catch(() => ({ rows: [{ count: 0 }] })),

    query(`
      SELECT COALESCE(SUM(ac.earned), 0) AS total
      FROM affiliate_conversion ac
      WHERE ac.vendor_id = $1 AND ac.created_at >= $2
    `, [partner.id, monthStart]).catch(() => ({ rows: [{ total: 0 }] })),

    query(`SELECT * FROM affiliate_payout WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 5`, [partner.id]).catch(() => ({ rows: [] })),

    query(`SELECT * FROM referral_code WHERE created_by = $1 ORDER BY created_at DESC LIMIT 5`, [partner.id]).catch(() => ({ rows: [] })),
  ]);

  return Response.json({
    is_affiliate: true,
    partner,
    this_month: {
      clicks: Number(monthClicks.rows[0]?.count ?? 0),
      conversions: Number(monthConversions.rows[0]?.count ?? 0),
      earned: Number(monthEarned.rows[0]?.total ?? 0),
    },
    pending_payout: Number(partner.total_earned) - Number(partner.total_paid),
    recent_payouts: payouts.rows,
    recent_links: recentLinks.rows,
  });
}
