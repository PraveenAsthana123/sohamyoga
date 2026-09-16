import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

export async function GET(req: NextRequest) {
  await ensureSocialIntelligenceSchema();
  const platform = req.nextUrl.searchParams.get('platform');
  const period = req.nextUrl.searchParams.get('period');

  const conditions: string[] = [];
  const params: string[] = [];
  let idx = 1;
  if (platform) { conditions.push(`platform = $${idx++}`); params.push(platform); }
  if (period) { conditions.push(`period = $${idx++}`); params.push(period); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM social_platform_analytics ${where} ORDER BY platform, period DESC`,
    params,
  );
  return NextResponse.json({ analytics: result.rows });
}
