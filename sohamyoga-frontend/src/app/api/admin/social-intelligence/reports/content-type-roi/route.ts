import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

export async function GET() {
  await ensureSocialIntelligenceSchema();

  // Get engagement rate by content type from variants + config
  const configResult = await query(`
    SELECT platform, content_type, display_name, avg_engagement_rate,
           best_posting_times, tips
    FROM social_content_type_config
    ORDER BY platform, avg_engagement_rate DESC
  `).catch(() => ({ rows: [] }));

  // Group by platform
  const byPlatform: Record<string, {
    platform: string;
    content_types: Array<{
      content_type: string;
      display_name: string;
      avg_engagement_rate: number;
      best_posting_times: string[];
      top_tip: string;
    }>;
  }> = {};

  for (const row of configResult.rows) {
    if (!byPlatform[row.platform]) {
      byPlatform[row.platform] = { platform: row.platform, content_types: [] };
    }
    byPlatform[row.platform].content_types.push({
      content_type: row.content_type,
      display_name: row.display_name,
      avg_engagement_rate: Number(row.avg_engagement_rate),
      best_posting_times: row.best_posting_times,
      top_tip: row.tips?.[0] ?? '',
    });
  }

  return NextResponse.json({ roi_by_platform: Object.values(byPlatform) });
}
