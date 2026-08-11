import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real influencer_profile rows joined to their latest InfluencerValueJob score. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const result = await query<{
    id: string; handle: string; platform: string; follower_count: number; engagement_rate: string | null;
    tier: string; status: string; has_code: boolean;
    referral_count: number | null; revenue_attributed: string | null; value_score: string | null;
    value_status: string | null; ai_note: string | null;
  }>(
    `SELECT p.id, p.handle, p.platform, p.follower_count, p.engagement_rate, p.tier, p.status,
            (p.referral_code_id IS NOT NULL) AS has_code,
            s.referral_count, s.revenue_attributed, s.value_score, s.value_status, s.ai_note
     FROM influencer_profile p
     LEFT JOIN influencer_value_score s ON s.influencer_id = p.id
     ORDER BY COALESCE(s.value_score, 0) DESC, p.handle ASC`,
  );

  return Response.json({
    hasData: (result.rowCount ?? 0) > 0,
    influencers: result.rows.map(r => ({
      id: r.id,
      handle: r.handle,
      platform: r.platform,
      followerCount: r.follower_count,
      engagementRate: r.engagement_rate ? Number(r.engagement_rate) : null,
      tier: r.tier,
      status: r.status,
      hasReferralCode: r.has_code,
      referralCount: r.referral_count ?? 0,
      revenueAttributed: r.revenue_attributed ? Number(r.revenue_attributed) : 0,
      valueScore: r.value_score ? Number(r.value_score) : 0,
      valueStatus: r.value_status ?? 'insufficient_data',
      aiNote: r.ai_note,
    })),
  });
}
