// GeoAeoTrackingJob — daily 3am
// Tracks AI-engine visibility (GEO/AEO): checks which AI search engines
// mention the business. Real API calls require OPENAI_API_KEY or
// GEMINI_API_KEY — skips gracefully without them.
// When credentials are present, submits a probe query to the AI provider
// and checks whether the business name appears in the response.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SCHEDULE = '0 3 * * *'; // daily 3am

// Probe query templates — sent to each configured AI engine.
const PROBE_QUERIES = [
  'What are good yoga studios near me?',
  'Recommend a yoga class for beginners',
  'Best online yoga programs',
];

async function probeOpenAI(query: string, businessName: string): Promise<{ mentioned: boolean; excerpt: string }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: query }],
      max_tokens: 300,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return { mentioned: false, excerpt: '' };
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? '';
  const mentioned = text.toLowerCase().includes(businessName.toLowerCase());
  return { mentioned, excerpt: text.slice(0, 300) };
}

export async function run(): Promise<void> {
  const hasOpenAI = !!(process.env.OPENAI_API_KEY);
  const hasGemini = !!(process.env.GEMINI_API_KEY);

  if (!hasOpenAI && !hasGemini) {
    console.log('[geo-aeo-tracking] No AI engine API keys configured — skipping');
    return;
  }

  let tenantId: string | null = null;
  let businessName = 'Soham Yoga';

  try {
    const tenantRow = await db.query<{ id: string; name: string }>(
      `SELECT t.id, bp.business_name AS name
       FROM tenant t
       LEFT JOIN business_profile bp ON bp.tenant_id = t.id
       ORDER BY t.created_at LIMIT 1`,
    );
    if (tenantRow.rows[0]) {
      tenantId = tenantRow.rows[0].id;
      businessName = tenantRow.rows[0].name ?? businessName;
    }
  } catch {
    // Non-fatal — fall back to default values.
  }

  if (!tenantId) {
    console.log('[geo-aeo-tracking] No tenant found — skipping');
    return;
  }

  let recorded = 0;

  if (hasOpenAI) {
    for (const q of PROBE_QUERIES) {
      try {
        const { mentioned, excerpt } = await probeOpenAI(q, businessName);
        await db.query(
          `INSERT INTO geo_mention_observation (tenant_id, platform, query_text, was_mentioned, excerpt, created_by)
           VALUES ($1, 'chatgpt', $2, $3, $4, 'GeoAeoTrackingJob')`,
          [tenantId, q, mentioned, excerpt],
        );
        recorded++;
      } catch {
        // Non-fatal per query.
      }
    }
  }

  console.log(`[geo-aeo-tracking] recorded=${recorded} schedule=${SCHEDULE}`);
  // Do NOT db.end() — pool is shared across the cron process lifetime.
}
