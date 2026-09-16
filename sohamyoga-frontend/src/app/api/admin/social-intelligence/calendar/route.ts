import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSocialIntelligenceSchema();
  const platform = req.nextUrl.searchParams.get('platform');
  const conditions = ['scheduled_at >= NOW()', 'scheduled_at <= NOW() + INTERVAL \'30 days\''];
  const params: string[] = [];
  if (platform) { conditions.push(`platform = $1`); params.push(platform); }
  const result = await query(
    `SELECT * FROM social_calendar_entry WHERE ${conditions.join(' AND ')} ORDER BY scheduled_at`,
    params,
  );
  return Response.json({ entries: result.rows });
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSocialIntelligenceSchema();
  const body = await req.json();
  const { platform, content_type, title, caption_preview, color_tag, scheduled_at, timezone, repeat_rule, variant_id } = body;
  if (!platform || !content_type || !scheduled_at) {
    return Response.json({ error: 'platform, content_type, scheduled_at required' }, { status: 400 });
  }
  const result = await query(
    `INSERT INTO social_calendar_entry (variant_id, platform, content_type, title, caption_preview, color_tag, scheduled_at, timezone, repeat_rule)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [variant_id ?? null, platform, content_type, title ?? null, caption_preview ?? null, color_tag ?? '#3B82F6', scheduled_at, timezone ?? 'UTC', repeat_rule ?? null],
  );
  return Response.json({ entry: result.rows[0] }, { status: 201 });
}
