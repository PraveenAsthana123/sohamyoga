// CampaignCopyDraftJob — Daily 06:00 UTC
// Generates AI campaign copy for approved briefs that have no content variants yet.
// Uses Ollama strong model. All output saved as DRAFT — never auto-published.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM = `You are a yoga studio marketing copywriter.
Given a campaign brief, write the MASTER campaign message (platform-neutral, ~100 words).
The message will be adapted per platform separately.
Tone: warm, inspiring, inclusive.
Return plain text only. No hashtags. No emojis. No platform-specific formatting.`;

export async function run(): Promise<void> {
  // Approved campaigns with no master copy yet
  const briefs = await db.query<{
    id: string; tenant_id: string; name: string;
    objective: string; offer_type: string;
    target_persona: string[]; content_sequence: string[];
  }>(`
    SELECT cb.id, cb.tenant_id, cb.name, cb.objective, cb.offer_type,
           cb.target_persona, cb.content_sequence
    FROM campaign_brief cb
    WHERE cb.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM content_variant cv WHERE cv.brief_id = cb.id
      )
    LIMIT 5
  `);

  let drafted = 0;

  for (const brief of briefs.rows) {
    try {
      const prompt = [
        `Campaign: ${brief.name}`,
        `Objective: ${brief.objective}`,
        `Offer: ${brief.offer_type}`,
        `Target: ${(brief.target_persona ?? []).join(', ')}`,
        `Sequence steps: ${(brief.content_sequence ?? []).join(' → ')}`,
      ].join('\n');

      const masterCopy = await ollama.generate(prompt, {
        tier: 'strong', system: SYSTEM, maxTokens: 300, timeoutMs: 60_000,
      });

      // Create one draft master variant (platform=email as canonical)
      await db.query(`
        INSERT INTO content_variant
          (tenant_id, brief_id, platform, master_content, adapted_content,
           is_ai_generated, ai_model_used, status)
        VALUES ($1, $2, 'email', $3, $3, true, 'ollama/strong', 'draft')
      `, [brief.tenant_id, brief.id, masterCopy]);

      drafted++;
    } catch (err) {
      console.error(`[campaign-copy-draft] brief ${brief.id}:`, err);
    }
  }

  console.log(`[campaign-copy-draft] drafted=${drafted}/${briefs.rows.length} master copies`);
  await db.end();
}
