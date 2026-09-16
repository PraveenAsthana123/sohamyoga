import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

export async function POST(req: NextRequest) {
  await ensureSocialIntelligenceSchema();
  const body = await req.json();
  const { platform, content_type, caption, scheduled_at, hashtags, media_urls } = body;

  if (!platform || !content_type || !scheduled_at) {
    return Response.json({ error: 'platform, content_type, scheduled_at required' }, { status: 400 });
  }

  // Create variant
  const variantResult = await query(
    `INSERT INTO social_content_variant (platform, content_type, caption, hashtags, media_urls, char_count, status, scheduled_at)
     VALUES ($1,$2,$3,$4,$5,$6,'scheduled',$7) RETURNING id`,
    [platform, content_type, caption ?? '', hashtags ?? [], media_urls ?? [], (caption ?? '').length, scheduled_at],
  );
  const variantId = variantResult.rows[0].id;

  // Create calendar entry
  const calResult = await query(
    `INSERT INTO social_calendar_entry (variant_id, platform, content_type, caption_preview, scheduled_at, status)
     VALUES ($1,$2,$3,$4,$5,'scheduled') RETURNING id`,
    [variantId, platform, content_type, (caption ?? '').slice(0, 120), scheduled_at],
  );

  return Response.json({ variant_id: variantId, calendar_id: calResult.rows[0].id }, { status: 201 });
}
