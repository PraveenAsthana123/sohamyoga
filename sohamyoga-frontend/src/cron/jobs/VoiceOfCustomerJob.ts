// VoiceOfCustomerJob — Weekly Friday 10:00 UTC
// Clusters real inbound customer text from the past 7 days into themes,
// complaints, and requests using Ollama. Grounded in two real sources only:
// campaign_lead.message (real contact-form submissions) and sentiment_log
// (real comment/manual sentiment classifications). NOT social listening in
// the competitor/public-mention sense — no API for that exists anywhere in
// this stack. Skips entirely (no digest created) if there's no real
// inbound text that week, rather than fabricating a "nothing happened"
// report or inventing themes from silence.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM = `You are a customer insights analyst for a yoga studio. You are given a list of
real, verbatim customer messages (contact-form inquiries and social comments) from the past week.
Cluster them into recurring themes. Return ONLY valid JSON:
{
  "themes": [{"label": "short theme name", "count": N, "sentiment": "positive"|"neutral"|"negative"}],
  "top_complaints": ["short complaint", ...],
  "top_requests": ["short feature/service request", ...],
  "overall_summary": "2-3 sentences"
}
Only use what is actually in the messages given — do not invent a theme, complaint, or request
that isn't grounded in at least one of the messages shown. If there's nothing notable in a
category, return an empty array for it.`;

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

interface Digest {
  themes: { label: string; count: number; sentiment: string }[];
  top_complaints: string[];
  top_requests: string[];
  overall_summary: string;
}

// Smaller local models don't always follow a strict string[] schema — e.g.
// phi4-mini returned {"short feature/service request": "Add a 7pm slot"}
// as an array element instead of the plain string, confirmed live. Coerce
// anything non-string to its first object value (or a compact fallback)
// so the admin UI never renders raw JSON.
function normalizeStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      const values = Object.values(item as Record<string, unknown>).filter(v => typeof v === 'string');
      if (values.length) return values.join(' — ');
    }
    return JSON.stringify(item);
  }).filter(Boolean);
}

export async function run(): Promise<void> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 7);
  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = periodEnd.toISOString().slice(0, 10);

  const tenants = await db.query<{ id: string }>(`SELECT id FROM tenant`);

  let created = 0;
  for (const tenant of tenants.rows) {
    const leads = await db.query<{ subject: string | null; message: string | null }>(
      `SELECT subject, message FROM campaign_lead
       WHERE tenant_id = $1 AND created_at >= $2 AND message IS NOT NULL`,
      [tenant.id, periodStart.toISOString()],
    );
    // sentiment_log has no tenant_id column (single-tenant table in this
    // schema) — included for every tenant since this deployment only has one.
    const comments = await db.query<{ text_content: string; sentiment: string }>(
      `SELECT text_content, sentiment FROM sentiment_log WHERE created_at >= $1`,
      [periodStart.toISOString()],
    );

    const messages = [
      ...leads.rows.map(l => `[Contact form${l.subject ? `: ${l.subject}` : ''}] ${l.message}`),
      ...comments.rows.map(c => `[Comment, ${c.sentiment}] ${c.text_content}`),
    ];

    if (messages.length === 0) continue; // nothing real to summarize — skip, don't fabricate

    let digest: Digest;
    try {
      const raw = await ollama.generate(
        messages.slice(0, 100).join('\n---\n'),
        { tier: 'strong', system: SYSTEM, maxTokens: 800, timeoutMs: 90_000 },
      );
      digest = extractJson<Digest>(raw);
      digest.top_complaints = normalizeStringArray(digest.top_complaints);
      digest.top_requests = normalizeStringArray(digest.top_requests);
    } catch (error) {
      console.error(`[voice-of-customer] tenant=${tenant.id} generation failed:`, error);
      continue;
    }

    const reportText = [
      digest.overall_summary,
      digest.themes.length ? `Themes: ${digest.themes.map(t => `${t.label} (${t.count}, ${t.sentiment})`).join('; ')}` : '',
      digest.top_complaints.length ? `Complaints: ${digest.top_complaints.join('; ')}` : '',
      digest.top_requests.length ? `Requests: ${digest.top_requests.join('; ')}` : '',
    ].filter(Boolean).join('\n\n');

    await db.query(
      `INSERT INTO voice_of_customer_digest
         (tenant_id, period_start, period_end, source_message_count, themes, top_complaints, top_requests, overall_summary, report_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (tenant_id, period_start, period_end) DO UPDATE SET
         source_message_count=$4, themes=$5, top_complaints=$6, top_requests=$7,
         overall_summary=$8, report_text=$9`,
      [tenant.id, periodStartStr, periodEndStr, messages.length,
        JSON.stringify(digest.themes), digest.top_complaints, digest.top_requests,
        digest.overall_summary, reportText],
    );
    created++;
  }

  console.log(`[voice-of-customer] tenants=${tenants.rows.length} digests_created=${created}`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
