import { NextRequest} from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
interface PlatformRow {
  platform: string;
  total_posts: string | number;
  avg_engagement_rate: string | number;
  total_impressions: string | number;
  total_reach: string | number;
  total_likes: string | number;
  total_comments: string | number;
  total_shares: string | number;
  follower_delta: string | number;
  follower_count: string | number;
}

export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSocialIntelligenceSchema();

  const result = await query<PlatformRow>(`
    SELECT
      platform,
      SUM(total_posts) as total_posts,
      AVG(avg_engagement_rate) as avg_engagement_rate,
      SUM(total_impressions) as total_impressions,
      SUM(total_reach) as total_reach,
      SUM(total_likes) as total_likes,
      SUM(total_comments) as total_comments,
      SUM(total_shares) as total_shares,
      SUM(follower_delta) as follower_delta,
      MAX(follower_count) as follower_count
    FROM social_platform_analytics
    GROUP BY platform
    ORDER BY avg_engagement_rate DESC
  `).catch(() => ({ rows: [] as PlatformRow[] }));

  const rows = result.rows;
  const maxReach = rows.reduce((m, r) => Math.max(m, Number(r.total_reach)), 0);
  const maxEngagement = rows.reduce((m, r) => Math.max(m, Number(r.avg_engagement_rate)), 0);

  const enriched = rows.map(r => ({
    ...r,
    best_for_reach: Number(r.total_reach) === maxReach,
    best_for_engagement: Number(r.avg_engagement_rate) === maxEngagement,
    recommended_actions: getRecommendedActions(r.platform, Number(r.avg_engagement_rate)),
  }));

  return Response.json({ platforms: enriched });
}

function getRecommendedActions(platform: string, engagementRate: number): string[] {
  const actions: Record<string, string[]> = {
    youtube: ['Optimize thumbnails for higher CTR', 'Add end screens to every video', 'Post Shorts to complement long-form'],
    facebook: ['Reduce link posts, increase native content', 'Use Reels for organic reach boost', 'Engage within first hour of posting'],
    instagram: ['Increase Reels frequency', 'Use all 30 hashtags per post', 'Post Stories 3x daily for visibility'],
    x_twitter: ['Remove external links from post body', 'Start threads on trending topics', 'Engage with replies within 15 min'],
    linkedin: ['Lead with a 5-line hook before "see more"', 'Post document carousels for max reach', 'Comment on 10 posts after publishing'],
    tiktok: ['Hook in first second is non-negotiable', 'Use trending sounds within 48h of trend start', 'Reply to comments with video responses'],
  };
  const base = actions[platform] ?? ['Analyze top performing content', 'Increase posting frequency', 'A/B test content formats'];
  if (engagementRate < 2) base.push('Engagement critically low — audit content relevance');
  return base;
}
