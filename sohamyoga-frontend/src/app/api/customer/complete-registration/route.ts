import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { ReferralCode, type ReferralCodeProps } from '@/domain/referral/ReferralCode';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Called immediately after POST /api/customer/auth/register succeeds (that
 * request is a raw proxy straight to the .NET backend via next.config.js's
 * fallback rewrite — it creates the real ASP.NET Identity account and sets
 * the session cookie, but creates no Postgres row at all). This route
 * creates the matching `customer` row for that now-authenticated session,
 * and — if a referral code was entered — attributes the signup for real:
 * validates the code via the real ReferralCode domain class, records a
 * referral_master row (status='registered'), and increments the code's
 * real use count. Previously this entire step didn't exist, so no
 * self-registered customer had a usable account anywhere else in the app
 * (e.g. /customer/referral 404'd with "no customer record found"), and no
 * referral click could ever become a real registered referral.
 */
export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const body = await req.json().catch(() => ({})) as {
    displayName?: string; marketingOptIn?: boolean; referralCode?: string;
  };
  if (!body.displayName?.trim()) {
    return Response.json({ error: 'displayName is required' }, { status: 400 });
  }

  const existing = await query<{ id: string }>(`SELECT id FROM customer WHERE user_id = $1`, [principal!.id]);
  if (existing.rowCount) {
    return Response.json({ customerId: existing.rows[0].id, alreadyExisted: true, referralAttributed: false });
  }

  const tenant = await query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
  if (!tenant.rowCount) return Response.json({ error: 'No tenant configured.' }, { status: 500 });
  const tenantId = tenant.rows[0].id;

  const customerId = randomUUID();
  await query(
    `INSERT INTO customer (id, tenant_id, user_id, display_name, email, email_opt_in, sms_opt_in, consent_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6, now())`,
    [customerId, tenantId, principal!.id, body.displayName.trim(), principal!.email ?? '', body.marketingOptIn ?? false],
  );

  let referralAttributed = false;
  const codeInput = body.referralCode?.trim();
  if (codeInput) {
    const codeRow = await query<{
      id: string; referrer_id: string; referrer_type: string; referral_url: string;
      status: string; max_uses: number | null; used_count: number; click_count: number;
      expires_at: string | null; created_at: string; updated_at: string;
    }>(`SELECT * FROM referral_code WHERE code = $1`, [codeInput]);

    if (codeRow.rowCount) {
      const r = codeRow.rows[0];
      const props: ReferralCodeProps = {
        id: r.id, code: codeInput, referrerId: r.referrer_id, referrerType: r.referrer_type as ReferralCodeProps['referrerType'],
        referralUrl: r.referral_url, status: r.status as ReferralCodeProps['status'],
        maxUses: r.max_uses ?? undefined, usedCount: r.used_count, clickCount: r.click_count,
        expiresAt: r.expires_at ? new Date(r.expires_at) : undefined,
        createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
      };
      const domainCode = new ReferralCode(props);

      // A customer cannot refer themselves — self-referral is a real fraud
      // vector the referral_master.fraud_flags column exists for.
      if (domainCode.canBeUsed() && r.referrer_id !== customerId) {
        const used = domainCode.recordUse();
        await query(`UPDATE referral_code SET used_count = $1, updated_at = $2 WHERE id = $3`, [used.usedCount, used.updatedAt, r.id]);

        const referralId = randomUUID();
        await query(
          `INSERT INTO referral_master (id, referral_code_id, referrer_id, referree_email, referree_id, type, status, registered_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'registered', now())`,
          [referralId, r.id, r.referrer_id, principal!.email ?? '', customerId, r.referrer_type],
        );
        await query(
          `INSERT INTO referral_registration (referral_id, referree_id, registration_source, registered_at)
           VALUES ($1, $2, 'customer_registration_form', now())`,
          [referralId, customerId],
        );
        referralAttributed = true;
      }
    }
  }

  return Response.json({ customerId, alreadyExisted: false, referralAttributed });
}
