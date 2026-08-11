import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Real KPIs + top referrers for /admin/referral — reads the migration-052
 * referral domain (referral_master/referral_reward/referral_campaign) and
 * its own v_top_referrers view directly. No mock numbers.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [kpi, campaigns, topReferrers, statusBreakdown, rewardTypes] = await Promise.all([
    query<{
      total_referrals: string; successful: string; pending_rewards: string;
      pending_reward_value: string | null; rewards_paid: string | null; revenue_generated: string | null;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM referral_master) AS total_referrals,
         (SELECT COUNT(*) FROM referral_master WHERE status = 'reward_paid') AS successful,
         (SELECT COUNT(*) FROM referral_reward WHERE status = 'pending') AS pending_rewards,
         (SELECT SUM(value) FROM referral_reward WHERE status = 'pending') AS pending_reward_value,
         (SELECT SUM(value) FROM referral_reward WHERE status = 'paid') AS rewards_paid,
         (SELECT SUM(order_amount) FROM referral_master WHERE order_amount IS NOT NULL) AS revenue_generated`,
    ),
    query<{ active: string }>(`SELECT COUNT(*) AS active FROM referral_campaign WHERE status = 'active'`),
    query<{
      referrer_id: string; total_referrals: string; successful: string;
      conversion_rate_pct: string | null; total_revenue_generated: string | null; referrer_name: string | null;
    }>(
      `SELECT v.*, COALESCE(c.display_name, s.display_name, tp.first_name || ' ' || tp.last_name) AS referrer_name
       FROM v_top_referrers v
       LEFT JOIN customer c ON c.id = v.referrer_id
       LEFT JOIN student s ON s.id = v.referrer_id
       LEFT JOIN teacher_profile tp ON tp.id = v.referrer_id
       ORDER BY v.successful DESC, v.total_revenue_generated DESC NULLS LAST
       LIMIT 10`,
    ),
    query<{ status: string; n: string }>(
      `SELECT status, COUNT(*)::text AS n FROM referral_master GROUP BY status`,
    ),
    query<{ type: string; n: string }>(
      `SELECT type, COUNT(*)::text AS n FROM referral_reward GROUP BY type ORDER BY COUNT(*) DESC`,
    ),
  ]);

  const row = kpi.rows[0];
  return Response.json({
    totalReferrals: Number(row.total_referrals),
    successful: Number(row.successful),
    conversionRatePct: Number(row.total_referrals) > 0
      ? Math.round((Number(row.successful) / Number(row.total_referrals)) * 1000) / 10 : 0,
    pendingRewards: Number(row.pending_rewards),
    pendingRewardValue: row.pending_reward_value ? Number(row.pending_reward_value) : 0,
    rewardsPaid: row.rewards_paid ? Number(row.rewards_paid) : 0,
    revenueGenerated: row.revenue_generated ? Number(row.revenue_generated) : 0,
    activeCampaigns: Number(campaigns.rows[0]?.active ?? 0),
    topReferrers: topReferrers.rows.map(r => ({
      referrerId: r.referrer_id,
      referrerName: r.referrer_name ?? `${r.referrer_id.slice(0, 8)}…`,
      totalReferrals: Number(r.total_referrals),
      successful: Number(r.successful),
      conversionRatePct: r.conversion_rate_pct ? Number(r.conversion_rate_pct) : 0,
      totalRevenueGenerated: r.total_revenue_generated ? Number(r.total_revenue_generated) : 0,
    })),
    statusBreakdown: Object.fromEntries(statusBreakdown.rows.map(s => [s.status, Number(s.n)])),
    rewardTypeDistribution: rewardTypes.rows.map(t => ({ type: t.type, count: Number(t.n) })),
  });
}
