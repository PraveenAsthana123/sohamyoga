import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { ReferralCode, type ReferralCodeProps } from '@/domain/referral/ReferralCode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sohamyoga.ca';

function generateCodeString(seed: string): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const prefix = seed.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase() || 'SOHAM';
  return `${prefix}-${random}`;
}

/**
 * Self-service code generation — any logged-in customer can request their
 * own referral code immediately, not just the customers ReferralInvitationJob
 * already proactively issued one to. Idempotent: returns the existing
 * active code if one already exists rather than issuing a second one.
 */
export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const customerRes = await query<{ id: string; display_name: string }>(`SELECT id, display_name FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!customerRes.rowCount) {
    return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });
  }
  const { id: customerId, display_name: displayName } = customerRes.rows[0];

  const existing = await query<{ code: string; referral_url: string }>(
    `SELECT code, referral_url FROM referral_code WHERE referrer_id = $1 AND referrer_type = 'customer_customer' AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [customerId],
  );
  if (existing.rowCount) {
    return Response.json({ code: existing.rows[0].code, referralUrl: existing.rows[0].referral_url, alreadyExisted: true });
  }

  const codeString = generateCodeString(displayName);
  const props: ReferralCodeProps = {
    id: crypto.randomUUID(),
    code: codeString,
    referrerId: customerId,
    referrerType: 'customer_customer',
    referralUrl: `${SITE_URL}/r/${codeString}`,
    status: 'active',
    usedCount: 0,
    clickCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const domainCode = new ReferralCode(props); // throws if invariants are violated

  await query(
    `INSERT INTO referral_code (id, code, referrer_id, referrer_type, referral_url, status, used_count, click_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [domainCode.id, domainCode.code, domainCode.referrerId, domainCode.referrerType, domainCode.referralUrl, domainCode.status, domainCode.usedCount, domainCode.clickCount],
  );

  return Response.json({ code: domainCode.code, referralUrl: domainCode.referralUrl, alreadyExisted: false });
}
