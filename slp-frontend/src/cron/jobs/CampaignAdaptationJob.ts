// CampaignAdaptationJob — Hourly :15
// Finds approved campaign content variants in DRAFT status and adapts them
// for their target platform using Ollama strong model.
// All outputs saved as DRAFT — require human approval before publish.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';
import { PLATFORM_LIMITS, ContentPlatform } from '../../domain/marketing/ContentVariant';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

function buildSystemPrompt(platform: ContentPlatform, brandKit: { tone_words: string[]; default_hashtags: string[] } | null) {
  const limits = PLATFORM_LIMITS[platform];
  const tone   = brandKit?.tone_words?.join(', ') ?? 'warm, mindful';
  const tags   = brandKit?.default_hashtags?.slice(0, 3).join(' ') ?? '#Yoga';

  return `You are a social media copywriter for a yoga studio.
Adapt the master message for ${platform}.
Rules:
- Max ${limits.maxChars === -1 ? 'unlimited' : limits.maxChars} characters (STRICT)
- Max ${limits.maxHashtags} hashtags
- Tone: ${limits.toneHint} — studio tone: ${tone}
- Include: ${tags}
- Return ONLY the adapted text. No explanation, no quotes, no markdown.`;
}

export async function run(): Promise<void> {
  // Variants that need AI adaptation (no adapted content yet or explicitly marked for regen)
  const variants = await db.query<{
    id: string; tenant_id: string; brief_id: string;
    platform: string; master_content: string;
  }>(`
    SELECT cv.id, cv.tenant_id, cv.brief_id, cv.platform, cv.master_content
    FROM content_variant cv
    JOIN campaign_brief cb ON cb.id = cv.brief_id
    WHERE cv.status = 'draft'
      AND cv.is_ai_generated = false
      AND cv.adapted_content = cv.master_content  -- not yet adapted
      AND cb.status IN ('approved', 'active')
    LIMIT 20
  `);

  if (variants.rows.length === 0) return;

  let adapted = 0;

  for (const v of variants.rows) {
    const platform = v.platform as ContentPlatform;
    if (!PLATFORM_LIMITS[platform]) continue;

    try {
      // Load brand kit for this tenant
      const bkRes = await db.query<{ tone_words: string[]; default_hashtags: string[] }>(`
        SELECT tone_words, default_hashtags FROM brand_kit
        WHERE tenant_id=$1 AND is_default=true LIMIT 1
      `, [v.tenant_id]);
      const brandKit = bkRes.rows[0] ?? null;

      const system  = buildSystemPrompt(platform, brandKit);
      const adapted_text = await ollama.generate(v.master_content, {
        tier:      'strong',
        system,
        maxTokens: 600,
        timeoutMs: 45_000,
      });

      // Validate char limit
      const limit = PLATFORM_LIMITS[platform].maxChars;
      if (limit !== -1 && adapted_text.length > limit) {
        console.warn(`[campaign-adaptation] ${platform} over limit (${adapted_text.length}>${limit}), skipping`);
        continue;
      }

      // Extract hashtags from the adapted text
      const hashtags = (adapted_text.match(/#\w+/g) ?? []).slice(0, PLATFORM_LIMITS[platform].maxHashtags);

      await db.query(`
        UPDATE content_variant SET
          adapted_content  = $1,
          hashtags         = $2,
          is_ai_generated  = true,
          ai_model_used    = 'ollama/strong',
          updated_at       = NOW()
        WHERE id = $3
      `, [adapted_text, hashtags, v.id]);

      // Save version history
      await db.query(`
        INSERT INTO content_variant_history (content_variant_id, version, adapted_content, changed_by)
        SELECT $1, COALESCE(MAX(version),0)+1, $2, 'cron_ollama'
        FROM content_variant_history WHERE content_variant_id=$1
      `, [v.id, adapted_text]);

      adapted++;
    } catch (err) {
      console.error(`[campaign-adaptation] variant ${v.id}:`, err);
    }
  }

  console.log(`[campaign-adaptation] adapted=${adapted}/${variants.rows.length}`);
  await db.end();
}
