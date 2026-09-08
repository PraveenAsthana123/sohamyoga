// Runs "for each" of the 35 registered platforms: derives a platform-fitted
// bio from the ONE approved social_brand_profile, via Ollama. Deliberately
// does not draft each platform independently from scratch -- doing so would
// let 35 disconnected AI calls drift the brand voice apart. Every platform
// bio is a resize/adaptation of the same approved source facts, so a
// customer following the studio on Instagram and LinkedIn reads a
// consistent identity, just fitted to each platform's real length norms.
// Skips honestly (no output) if the master profile isn't approved yet --
// never derives from an unapproved draft.
import { Pool } from 'pg';
import { ollama } from '../OllamaClient';
import { bioTierFor } from '../../domain/social/provisioning';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM = `You adapt an already-approved brand bio to fit a specific social platform's real
tone and length convention, using ONLY the facts given. Do not add any claim, name, number, or
detail not present in the source bio. Keep the same character limit as the source text you were
given -- your job is tone/format fit, not expansion. Return exactly one JSON object:
{"bio_text": "<= the given character limit"}`;

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

export async function run(): Promise<void> {
  const profile = await db.query<{ id: string; bio_80: string; bio_150: string; bio_255: string; approval_status: string }>(
    `SELECT id, bio_80, bio_150, bio_255, approval_status FROM social_brand_profile ORDER BY created_at DESC LIMIT 1`,
  );
  if (!profile.rowCount) { console.log('[platform-bio-draft] no brand profile exists yet, skipping'); return; }
  const p = profile.rows[0];
  if (p.approval_status !== 'approved') { console.log(`[platform-bio-draft] brand profile is '${p.approval_status}', not approved -- skipping until a human approves it`); return; }

  const platforms = await db.query<{ platform: string }>(`SELECT platform FROM social_platform_requirement ORDER BY platform`);
  const existing = await db.query<{ platform: string }>(`SELECT platform FROM social_platform_bio WHERE source_profile_id = $1`, [p.id]);
  const done = new Set(existing.rows.map(r => r.platform));

  let drafted = 0;
  for (const row of platforms.rows) {
    if (done.has(row.platform)) continue;
    const tier = bioTierFor(row.platform);
    const sourceText = { bio_80: p.bio_80, bio_150: p.bio_150, bio_255: p.bio_255 }[tier];
    const charLimit = { bio_80: 80, bio_150: 150, bio_255: 255 }[tier];

    let bioText = sourceText;
    try {
      const response = await ollama.generate(
        `Platform: ${row.platform}\nCharacter limit: ${charLimit}\nSource bio: ${sourceText}`,
        { tier: 'fast', system: SYSTEM, maxTokens: 300, timeoutMs: 30_000 },
      );
      const parsed = extractJson<{ bio_text: string }>(response);
      if (parsed.bio_text && parsed.bio_text.length <= charLimit) bioText = parsed.bio_text;
    } catch {
      // Deterministic fallback: the source tier text itself always fits,
      // since it was generated against the same character limit.
    }

    await db.query(
      `INSERT INTO social_platform_bio (platform, source_profile_id, bio_tier, bio_text, status)
       VALUES ($1,$2,$3,$4,'draft')
       ON CONFLICT (platform) DO UPDATE SET source_profile_id = EXCLUDED.source_profile_id,
         bio_tier = EXCLUDED.bio_tier, bio_text = EXCLUDED.bio_text, status = 'draft', updated_at = now()`,
      [row.platform, p.id, tier, bioText],
    );
    drafted++;
  }
  console.log(`[platform-bio-draft] platforms=${platforms.rows.length} newly_drafted=${drafted} already_had_one=${done.size}`);
}
