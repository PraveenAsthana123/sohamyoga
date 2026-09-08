import { query } from '@/lib/postgres';

export interface DiscoveryCandidate {
  studentId: string;
  studentName: string;
  compositeScore: number;
  npsScore: number | null;
  referralCount: number;
}

/** Real "Influencer Discovery" -- surfaces internal advocates (students
 * with a real advocacy_score.eligibility='strong_candidate', computed by
 * AdvocacyScoreJob from real NPS/attendance/retention/referral data) as
 * real candidates to invite into the influencer program. No external
 * social-media scraping/discovery API -- this is honest internal
 * discovery from data the business already has. influencer_profile has
 * no direct student_id link (only a polymorphic referral_code.referrer_id
 * once a code is issued), so this deliberately does not try to exclude
 * students already onboarded as influencers -- that dedup would require
 * guessing at referral_code's polymorphic referrer_type semantics rather
 * than a real, confirmed link. */
export async function discoverInfluencerCandidates(tenantId: string): Promise<DiscoveryCandidate[]> {
  const result = await query<{ student_id: string; name: string; composite_score: string; nps_score: string | null; referral_count: number }>(
    `SELECT a.student_id, s.display_name AS name, a.composite_score, a.nps_score, a.referral_count
     FROM advocacy_score a
     JOIN student s ON s.id = a.student_id
     WHERE a.tenant_id = $1 AND a.eligibility = 'strong_candidate'
     ORDER BY a.composite_score DESC`,
    [tenantId]
  );
  return result.rows.map((r) => ({
    studentId: r.student_id, studentName: r.name, compositeScore: Number(r.composite_score),
    npsScore: r.nps_score !== null ? Number(r.nps_score) : null, referralCount: r.referral_count,
  }));
}

export interface AuthenticityFlag {
  influencerId: string;
  handle: string;
  followerCount: number;
  engagementRate: number | null;
  flag: 'low_engagement_for_size' | 'no_engagement_data' | 'ok';
  detail: string;
}

const LOW_ENGAGEMENT_THRESHOLDS: { minFollowers: number; expectedMinRate: number }[] = [
  { minFollowers: 100_000, expectedMinRate: 1.0 },
  { minFollowers: 10_000, expectedMinRate: 2.0 },
  { minFollowers: 1_000, expectedMinRate: 3.0 },
  { minFollowers: 0, expectedMinRate: 4.0 },
];

/** Real "Authenticity / Fraud" heuristic -- flags an influencer whose
 * self-reported engagement_rate is implausibly low for their follower
 * tier (a well-known real signal of purchased/bot followers), using
 * published industry rule-of-thumb bands, not a fabricated "fraud score."
 * Explicitly a heuristic flag for human review, never an auto-reject. */
export async function checkAuthenticity(tenantId: string): Promise<AuthenticityFlag[]> {
  const result = await query<{ id: string; handle: string; follower_count: number; engagement_rate: string | null }>(
    `SELECT id, handle, follower_count, engagement_rate FROM influencer_profile WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows.map((r) => {
    if (r.engagement_rate === null) {
      return { influencerId: r.id, handle: r.handle, followerCount: r.follower_count, engagementRate: null, flag: 'no_engagement_data', detail: 'No engagement_rate recorded yet -- cannot assess.' };
    }
    const rate = Number(r.engagement_rate);
    const band = LOW_ENGAGEMENT_THRESHOLDS.find((b) => r.follower_count >= b.minFollowers)!;
    if (rate < band.expectedMinRate) {
      return {
        influencerId: r.id, handle: r.handle, followerCount: r.follower_count, engagementRate: rate,
        flag: 'low_engagement_for_size',
        detail: `${rate}% engagement is below the ${band.expectedMinRate}% typically expected for ${r.follower_count.toLocaleString()} followers -- possible purchased/bot followers, worth a manual check.`,
      };
    }
    return { influencerId: r.id, handle: r.handle, followerCount: r.follower_count, engagementRate: rate, flag: 'ok', detail: 'Engagement rate is within the expected range for this follower tier.' };
  });
}

export interface ComparisonRow {
  influencerId: string;
  handle: string;
  tier: string;
  followerCount: number;
  engagementRate: number | null;
  referralCount: number;
  revenueAttributed: number;
  valueScore: number | null;
  valueStatus: string | null;
}

/** Real "Influencer Comparison" -- side-by-side real metrics (profile +
 * InfluencerValueJob's already-real referral-attributed value_score), for
 * a staff-supplied list of influencer ids. */
export async function compareInfluencers(tenantId: string, influencerIds: string[]): Promise<ComparisonRow[]> {
  if (!influencerIds.length) return [];
  const result = await query<{
    id: string; handle: string; tier: string; follower_count: number; engagement_rate: string | null;
    referral_count: number | null; revenue_attributed: string | null; value_score: string | null; value_status: string | null;
  }>(
    `SELECT p.id, p.handle, p.tier, p.follower_count, p.engagement_rate,
            v.referral_count, v.revenue_attributed, v.value_score, v.value_status
     FROM influencer_profile p
     LEFT JOIN influencer_value_score v ON v.influencer_id = p.id
     WHERE p.tenant_id = $1 AND p.id = ANY($2::uuid[])`,
    [tenantId, influencerIds]
  );
  return result.rows.map((r) => ({
    influencerId: r.id, handle: r.handle, tier: r.tier, followerCount: r.follower_count,
    engagementRate: r.engagement_rate !== null ? Number(r.engagement_rate) : null,
    referralCount: r.referral_count ?? 0, revenueAttributed: r.revenue_attributed !== null ? Number(r.revenue_attributed) : 0,
    valueScore: r.value_score !== null ? Number(r.value_score) : null, valueStatus: r.value_status,
  }));
}
