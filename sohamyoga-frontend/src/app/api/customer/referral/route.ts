import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Real referral data for the logged-in customer's self-service page:
 * their own referral_code (if issued — by ReferralInvitationJob or via
 * generate-code below), the real active campaign's reward terms (if any),
 * their real wallet balance, and their real referral history as referrer.
 */
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const customerRes = await query<{ id: string }>(`SELECT id FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!customerRes.rowCount) {
    return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });
  }
  const customerId = customerRes.rows[0].id;

  const [code, campaign, wallet, history] = await Promise.all([
    query<{
      code: string; referral_url: string; status: string; click_count: number; used_count: number;
      invitation_draft: string | null; invitation_drafted_at: string | null;
    }>(
      `SELECT code, referral_url, status, click_count, used_count, invitation_draft, invitation_drafted_at
       FROM referral_code WHERE referrer_id = $1 AND referrer_type = 'customer_customer' AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [customerId],
    ),
    query<{ name: string; reward_type: string; referrer_reward_value: string; referree_reward_value: string }>(
      `SELECT name, reward_type, referrer_reward_value, referree_reward_value
       FROM referral_campaign WHERE status = 'active' AND 'customer_customer' = ANY(eligible_referral_types)
       ORDER BY created_at DESC LIMIT 1`,
    ),
    query<{ balance: string; lifetime_earned: string }>(
      `SELECT balance, lifetime_earned FROM referral_wallet WHERE customer_id = $1`,
      [customerId],
    ),
    query<{ referree_email: string; status: string; created_at: string }>(
      `SELECT referree_email, status, created_at FROM referral_master WHERE referrer_id = $1 ORDER BY created_at DESC LIMIT 25`,
      [customerId],
    ),
  ]);

  return Response.json({
    hasCode: (code.rowCount ?? 0) > 0,
    code: code.rowCount ? {
      code: code.rows[0].code,
      referralUrl: code.rows[0].referral_url,
      status: code.rows[0].status,
      clickCount: code.rows[0].click_count,
      usedCount: code.rows[0].used_count,
      invitationDraft: code.rows[0].invitation_draft,
      invitationDraftedAt: code.rows[0].invitation_drafted_at,
    } : null,
    activeCampaign: campaign.rowCount ? {
      name: campaign.rows[0].name,
      rewardType: campaign.rows[0].reward_type,
      referrerRewardValue: Number(campaign.rows[0].referrer_reward_value),
      referreeRewardValue: Number(campaign.rows[0].referree_reward_value),
    } : null,
    wallet: wallet.rowCount ? { balance: Number(wallet.rows[0].balance), lifetimeEarned: Number(wallet.rows[0].lifetime_earned) } : { balance: 0, lifetimeEarned: 0 },
    history: history.rows.map(h => ({ referreeEmail: h.referree_email, status: h.status, createdAt: h.created_at })),
  });
}
