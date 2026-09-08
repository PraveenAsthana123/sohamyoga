import { query } from '@/lib/postgres';

export interface TrendingHashtag {
  hashtag: string;
  viralPostCount: number;
  avgViralScore: number;
}

/** Real "Trend Discovery" -- surfaces which hashtags/topics actually
 * appear in this account's own real viral_signal-flagged posts (via
 * social_post -> social_platform_variant.hashtags, matched on the same
 * draft_id + platform the post was actually published from), never a
 * fabricated external "trending now" feed with no real data source. Empty
 * until ViralDetectionJob has flagged at least one real post as viral. */
export async function discoverTrendingHashtags(tenantId: string): Promise<TrendingHashtag[]> {
  const result = await query<{ hashtag: string; post_count: string; avg_score: string }>(
    `SELECT unnest(v.hashtags) AS hashtag, count(DISTINCT vs.post_id)::text AS post_count, avg(vs.viral_score)::text AS avg_score
     FROM viral_signal vs
     JOIN social_post sp ON sp.id = vs.post_id
     JOIN social_platform_variant v ON v.draft_id = sp.draft_id AND v.platform = sp.platform
     WHERE vs.tenant_id = $1 AND vs.is_viral = true
     GROUP BY unnest(v.hashtags)
     ORDER BY post_count DESC, avg_score DESC
     LIMIT 20`,
    [tenantId]
  );
  return result.rows.map((r) => ({
    hashtag: r.hashtag,
    viralPostCount: Number(r.post_count),
    avgViralScore: Math.round(Number(r.avg_score) * 10) / 10,
  }));
}
