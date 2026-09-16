import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

async function access(req: NextRequest) {
  const auth = await getAdminPrincipal(req);
  if (auth.denied) return auth;
  if (!databaseConfigured()) return { denied: Response.json({ error: 'Database unavailable.' }, { status: 503 }) };
  return auth;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;

  const [partner, clicks, conversions, payouts] = await Promise.all([
    query(`SELECT p.*, (p.total_earned - p.total_paid) AS outstanding_balance FROM affiliate_partner p WHERE p.id = $1`, [params.id]),
    query(`SELECT COUNT(*) AS click_count, MAX(created_at) AS last_click FROM referral_click WHERE referral_code_id IN (SELECT id FROM referral_code WHERE created_by = $1) LIMIT 1`, [params.id]).catch(() => ({ rows: [{ click_count: 0, last_click: null }] })),
    query(`SELECT ac.*, o.order_number FROM affiliate_conversion ac LEFT JOIN sales_order o ON o.id = ac.order_id WHERE ac.vendor_id = (SELECT customer_id FROM affiliate_partner WHERE id = $1) ORDER BY ac.created_at DESC LIMIT 50`, [params.id]).catch(() => ({ rows: [] })),
    query(`SELECT * FROM affiliate_payout WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 20`, [params.id]).catch(() => ({ rows: [] })),
  ]);

  if (!partner.rowCount) return Response.json({ error: 'Partner not found.' }, { status: 404 });

  return Response.json({
    partner: partner.rows[0],
    clicks: clicks.rows[0],
    conversions: conversions.rows,
    payouts: payouts.rows,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const fields: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  const allowed = ['name', 'email', 'website', 'niche', 'audience_size', 'tier', 'status',
    'commission_rate_bps', 'custom_rate_override', 'cookie_window_days',
    'application_notes', 'rejection_reason', 'social_handles'];

  for (const k of allowed) {
    if (k in body) {
      fields.push(`${k} = $${i++}`);
      vals.push(body[k]);
    }
  }

  if (!fields.length) return Response.json({ error: 'No fields to update.' }, { status: 400 });

  fields.push(`updated_at = NOW()`);
  vals.push(params.id);

  const result = await query(
    `UPDATE affiliate_partner SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );

  return result.rowCount
    ? Response.json({ ok: true, partner: result.rows[0] })
    : Response.json({ error: 'Not found.' }, { status: 404 });
}
