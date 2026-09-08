// Drafts the single, real, tenant-level social_brand_profile row -- a table
// that has existed in this codebase since the original provisioning
// migration but had zero writers anywhere. Grounded ONLY in verified real
// tenant facts (name, business type, timezone/region); never invents years
// in business, instructor names, class counts, or any other unverified
// claim. Always lands in 'draft' status -- a human must approve it before
// any platform bio derives from it.
//
// A first version of this job asked Ollama to reproduce the business name
// and region verbatim inside free-text copy -- caught live producing
// "Edderton" for "Edmonton" and inventing "expert instructors" despite an
// explicit instruction not to. Fixed two ways, not just a stronger prompt:
// (1) placeholder substitution -- the model writes around {{NAME}}/{{REGION}}
// tokens it never has to spell itself, so a proper noun literally cannot be
// corrupted by generation; (2) a post-generation banned-phrase scan that
// discards the whole draft in favor of the deterministic fallback if it
// still finds an unverified quality claim.
import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface Draft {
  tagline: string; bio_80: string; bio_150: string; bio_255: string;
  description_1000: string; keywords: string[]; default_hashtags: string[];
}

const SYSTEM = `You write brand profile copy for a real small business, using ONLY the facts
given to you. Use the literal tokens {{NAME}} and {{REGION}} in your copy wherever the business
name or region would appear -- do not spell out the actual name or region yourself, the tokens
will be substituted afterward. Hard rules, no exceptions:
1. Never use any adjective describing staff/instructor quality or experience (e.g. "expert",
   "experienced", "skilled", "professional instructors") -- no such fact was given to you.
2. Never invent years in operation, staff names, class types, class counts, client counts,
   certifications, or awards -- none were given to you.
3. If you are not certain a sentence is fully supported by the given facts, cut it.
Write in a plain, factual tone. Return exactly one JSON object with these exact keys and
character limits (count {{NAME}}/{{REGION}} at their real character length when checking limits):
{"tagline": "<=60 chars", "bio_80": "<=80 chars", "bio_150": "<=150 chars",
"bio_255": "<=255 chars", "description_1000": "<=1000 chars, 2-4 short paragraphs",
"keywords": ["5-10 lowercase keywords"], "default_hashtags": ["5-8 hashtags, no spaces, no # needed in the string"]}`;

const BANNED_PHRASES = [
  'expert', 'experienced instructor', 'experienced teacher', 'skilled instructor',
  'professional instructor', 'certified instructor', 'award-winning', 'years of experience',
];

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…';
}

function substitutePlaceholders(text: string, name: string, region: string): string {
  return text.replaceAll('{{NAME}}', name).replaceAll('{{REGION}}', region);
}

function containsBannedPhrase(draft: Draft): string | null {
  const haystack = [draft.tagline, draft.bio_80, draft.bio_150, draft.bio_255, draft.description_1000].join(' ').toLowerCase();
  return BANNED_PHRASES.find(p => haystack.includes(p)) ?? null;
}

function deterministicFallback(name: string, region: string, businessType: string): Draft {
  return {
    tagline: `${name} — Yoga for every body`,
    bio_80: `${name}: yoga classes for all levels in ${region}.`,
    bio_150: `${name} offers yoga classes for individuals and groups in ${region}. All levels welcome.`,
    bio_255: `${name} is ${businessType} based in ${region}. We offer classes for individuals and groups, welcoming students of every experience level.`,
    description_1000: `${name} is ${businessType} based in ${region}.\n\nWe welcome students of every experience level and offer a range of class formats.`,
    keywords: ['yoga', 'wellness', region.toLowerCase(), 'fitness', 'mindfulness'],
    default_hashtags: ['yoga', 'wellness', 'mindfulness'],
  };
}

export async function run(): Promise<void> {
  const tenant = await db.query<{ id: string; name: string; type: string; timezone: string; locale: string }>(
    `SELECT id, name, type, timezone, locale FROM tenant ORDER BY created_at LIMIT 1`,
  );
  if (!tenant.rowCount) { console.log('[brand-profile-draft] no tenant exists, skipping'); return; }
  const t = tenant.rows[0];

  const existing = await db.query(`SELECT id FROM social_brand_profile WHERE tenant_id = $1`, [t.id]);
  if (existing.rowCount) { console.log('[brand-profile-draft] profile already exists, skipping'); return; }

  const region = t.timezone.split('/')[1]?.replace('_', ' ') ?? t.timezone;
  const businessType = t.type === 'b2b_studio' ? 'a yoga studio serving both individual students and corporate/studio clients' : 'a yoga studio';
  const facts = `Business type: ${businessType}\nLocale: ${t.locale}\n(Use the literal tokens {{NAME}} and {{REGION}} for the business name and region.)`;

  let draft: Draft;
  let source: 'ollama' | 'fallback' = 'ollama';
  try {
    const response = await ollama.generate(facts, { tier: 'strong', system: SYSTEM, maxTokens: 900, timeoutMs: 60_000 });
    const raw = extractJson<Draft>(response);
    draft = {
      tagline: substitutePlaceholders(raw.tagline, t.name, region),
      bio_80: substitutePlaceholders(raw.bio_80, t.name, region),
      bio_150: substitutePlaceholders(raw.bio_150, t.name, region),
      bio_255: substitutePlaceholders(raw.bio_255, t.name, region),
      description_1000: substitutePlaceholders(raw.description_1000, t.name, region),
      keywords: raw.keywords,
      default_hashtags: raw.default_hashtags,
    };
    const banned = containsBannedPhrase(draft);
    if (banned) {
      console.log(`[brand-profile-draft] Ollama draft contained a banned unverified claim ("${banned}") — discarding it for the deterministic fallback`);
      draft = deterministicFallback(t.name, region, businessType);
      source = 'fallback';
    }
  } catch (error) {
    console.log(`[brand-profile-draft] Ollama failed (${error instanceof Error ? error.message : error}), using a deterministic fallback`);
    draft = deterministicFallback(t.name, region, businessType);
    source = 'fallback';
  }

  await db.query(
    `INSERT INTO social_brand_profile (tenant_id, brand_name, tagline, bio_80, bio_150, bio_255, description_1000, keywords, default_hashtags, approval_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft')`,
    [
      t.id, t.name, truncate(draft.tagline, 60), truncate(draft.bio_80, 80), truncate(draft.bio_150, 150),
      truncate(draft.bio_255, 255), truncate(draft.description_1000, 1000),
      draft.keywords.slice(0, 10), draft.default_hashtags.slice(0, 8),
    ],
  );
  console.log(`[brand-profile-draft] drafted profile for tenant ${t.name} (source=${source}), status=draft (awaiting human approval)`);
}
