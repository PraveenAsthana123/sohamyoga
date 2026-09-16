import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

export async function GET(req: NextRequest) {
  await ensureSocialIntelligenceSchema();
  const platform = req.nextUrl.searchParams.get('platform');
  const period = req.nextUrl.searchParams.get('period') ?? new Date().toISOString().slice(0, 7);

  const conditions = ['period = $1'];
  const params: string[] = [period];
  if (platform) { conditions.push('platform = $2'); params.push(platform); }

  const result = await query(
    `SELECT platform, period, total_posts, total_impressions, total_reach,
            total_likes, total_comments, total_shares, avg_engagement_rate,
            follower_count, follower_delta
     FROM social_platform_analytics
     WHERE ${conditions.join(' AND ')}
     ORDER BY platform`,
    params,
  ).catch(() => ({ rows: [] }));

  return Response.json({ analytics: result.rows, period });
}
