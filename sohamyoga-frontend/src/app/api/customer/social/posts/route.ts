import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

export async function GET(req: NextRequest) {
  await ensureSocialIntelligenceSchema();
  const platform = req.nextUrl.searchParams.get('platform');
  const content_type = req.nextUrl.searchParams.get('content_type');
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  const conditions: string[] = ["sp.status = 'published'"];
  const params: string[] = [];
  let idx = 1;
  if (platform) { conditions.push(`sp.platform = $${idx++}`); params.push(platform); }
  if (from) { conditions.push(`sp.scheduled_at >= $${idx++}`); params.push(from); }
  if (to) { conditions.push(`sp.scheduled_at <= $${idx++}`); params.push(to); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const result = await query(
    `SELECT sp.id, sp.platform, sp.status, sp.scheduled_at,
            COALESCE(sp.caption, '') as caption_preview,
            COALESCE(spa.impressions, 0) as impressions,
            COALESCE(spa.likes, 0) as likes,
            COALESCE(spa.comments, 0) as comments,
            COALESCE(spa.shares, 0) as shares
     FROM social_post sp
     LEFT JOIN social_post_analytics spa ON spa.post_id = sp.id
     ${where}
     ORDER BY sp.scheduled_at DESC
     LIMIT 50`,
    params,
  ).catch(() => ({ rows: [] }));

  return NextResponse.json({ posts: result.rows });
}
