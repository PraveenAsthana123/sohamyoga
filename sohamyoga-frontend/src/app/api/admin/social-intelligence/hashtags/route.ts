import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSocialIntelligenceSchema();
  const platform = req.nextUrl.searchParams.get('platform');
  const niche = req.nextUrl.searchParams.get('niche');
  const conditions: string[] = [];
  const params: string[] = [];
  let idx = 1;
  if (platform) { conditions.push(`platform = $${idx++}`); params.push(platform); }
  if (niche) { conditions.push(`niche = $${idx++}`); params.push(niche); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM social_hashtag_performance ${where} ORDER BY trending_score DESC, avg_reach DESC LIMIT 200`,
    params,
  );
  return Response.json({ hashtags: result.rows });
}
