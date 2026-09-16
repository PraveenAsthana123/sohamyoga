import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSocialIntelligenceSchema();
  const platform = req.nextUrl.searchParams.get('platform');
  const status = req.nextUrl.searchParams.get('status');
  const conditions: string[] = [];
  const params: string[] = [];
  let idx = 1;
  if (platform) { conditions.push(`platform = $${idx++}`); params.push(platform); }
  if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM social_content_variant ${where} ORDER BY created_at DESC LIMIT 100`,
    params,
  );
  return Response.json({ variants: result.rows });
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSocialIntelligenceSchema();
  const body = await req.json();
  const {
    draft_id, platform, content_type, caption, title, description,
    hashtags, mentions, media_urls, thumbnail_url, cta_text, cta_url,
    duration_seconds, aspect_ratio, platform_specific,
    char_count, word_count, ai_generated, ai_model, ai_prompt,
    status, scheduled_at,
  } = body;
  if (!platform) return Response.json({ error: 'platform is required' }, { status: 400 });
  if (!content_type) return Response.json({ error: 'content_type is required' }, { status: 400 });

  const captionText = caption ?? '';
  const computedCharCount = char_count ?? captionText.length;
  const computedWordCount = word_count ?? captionText.split(/\s+/).filter(Boolean).length;

  const result = await query(
    `INSERT INTO social_content_variant
       (draft_id, platform, content_type, caption, title, description,
        hashtags, mentions, media_urls, thumbnail_url, cta_text, cta_url,
        duration_seconds, aspect_ratio, platform_specific,
        char_count, word_count, ai_generated, ai_model, ai_prompt, status, scheduled_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING *`,
    [
      draft_id ?? null, platform, content_type, captionText, title ?? null, description ?? null,
      hashtags ?? [], mentions ?? [], media_urls ?? [], thumbnail_url ?? null, cta_text ?? null, cta_url ?? null,
      duration_seconds ?? null, aspect_ratio ?? null, platform_specific ?? {},
      computedCharCount, computedWordCount, ai_generated ?? false, ai_model ?? null, ai_prompt ?? null,
      status ?? 'draft', scheduled_at ?? null,
    ],
  );
  return Response.json({ variant: result.rows[0] }, { status: 201 });
}
