import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real referral_campaign rows for the /admin/referral "Campaigns" tab. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const result = await query<{
    id: string; name: string; type: string; status: string; reward_type: string;
    referrer_reward_value: string; referree_reward_value: string;
    total_referrals: number; total_rewards_paid: string;
    successful: string;
  }>(
    `SELECT rc.id, rc.name, rc.type, rc.status, rc.reward_type, rc.referrer_reward_value, rc.referree_reward_value,
            rc.total_referrals, rc.total_rewards_paid,
            COUNT(rm.id) FILTER (WHERE rm.status = 'reward_paid') AS successful
     FROM referral_campaign rc
     LEFT JOIN referral_code rcd ON rcd.campaign_id = rc.id
     LEFT JOIN referral_master rm ON rm.referral_code_id = rcd.id
     GROUP BY rc.id
     ORDER BY rc.created_at DESC`,
  );

  return Response.json({
    campaigns: result.rows.map(c => ({
      name: c.name,
      type: c.type,
      status: c.status,
      rewardType: c.reward_type,
      referrerReward: Number(c.referrer_reward_value),
      referreeReward: Number(c.referree_reward_value),
      referrals: c.total_referrals,
      paid: Number(c.total_rewards_paid),
      conversion: c.total_referrals > 0 ? Math.round((Number(c.successful) / c.total_referrals) * 1000) / 10 : 0,
    })),
  });
}
