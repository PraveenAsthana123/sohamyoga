// YogaEducationContentJob — Weekly Wednesday 09:00 UTC
// AI-drafts real educational/marketing content across 5 topics (class
// list, types of yoga, best practices, benefits, challenges) and multiple
// formats (banner copy, social text, video script, comparison table,
// bulleted list, data-narrative "graph"). Every draft lands in the same
// real social_content_draft pipeline the Social Scheduler (/admin/social/
// scheduler) already reviews/approves/schedules — never auto-published.
//
// "Class list" content is grounded in the real class_session table, not
// invented — if the studio has only one real class scheduled, the draft
// says so rather than inventing a fuller schedule. The other four topics
// are general yoga knowledge (types, practices, benefits, challenges),
// which is legitimate educational content for Ollama to write, distinct
// from the fabricated BUSINESS metrics (ratings, revenue, integrations)
// this session has consistently refused to invent elsewhere.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

type Format = 'banner' | 'text' | 'video' | 'table' | 'list' | 'graph';
// social_content_draft.content_type has no table/list/graph value — mapped
// to the closest real enum member; the actual structured content (table
// markdown, bulleted list, data narrative) lives in master_text either way.
const CONTENT_TYPE: Record<Format, string> = {
  banner: 'image', text: 'text', video: 'short', table: 'text', list: 'text', graph: 'text',
};

const FORMAT_INSTRUCTIONS: Record<Format, string> = {
  banner: 'Write a short banner headline (max 12 words) plus one-line supporting copy, for an image overlay.',
  text: 'Write a social media post (max 280 characters), warm and inviting tone.',
  video: 'Write a 30-45 second video script with scene directions in brackets.',
  table: 'Write a markdown comparison table (3-6 rows) directly relevant to the topic. Only real, generally-known information — no invented statistics.',
  list: 'Write a bulleted markdown list (4-8 items), concise, one line each.',
  graph: 'Write a short narrative (2-3 sentences) describing a general trend or comparison relevant to the topic, as if summarizing a simple chart. State it is illustrative/general guidance, not studio-specific data.',
};

interface Topic { slug: string; title: string; brief: string }

async function buildTopics(): Promise<Topic[]> {
  // start_time/session_date/duration_minutes are included explicitly — a
  // live run without them found Ollama inventing a plausible-but-wrong
  // class time for the table format ("08:00 AM" when the real row is
  // 09:00) despite an instruction not to invent classes; that instruction
  // covered extra classes, not schedule details of a real one. Giving it
  // the real time removes the need to guess at all.
  const classes = await db.query<{ class_name: string; teacher_name: string; session_date: string; start_time: string; duration_minutes: number }>(
    `SELECT class_name, teacher_name, session_date, start_time, duration_minutes FROM class_session ORDER BY session_date LIMIT 10`,
  );
  const classList = classes.rows.length
    ? classes.rows.map(c => `${c.class_name} with ${c.teacher_name}, ${c.session_date} at ${c.start_time} (${c.duration_minutes} min)`).join('; ')
    : 'No classes are currently scheduled in the system.';

  return [
    { slug: 'class-list', title: 'Our Class Schedule', brief: `The studio's real currently-scheduled classes, with their real date/time/duration: ${classList}. Write about exactly what's given — do not invent additional classes, and do not invent or alter any date, time, or duration.` },
    { slug: 'types-of-yoga', title: 'Types of Yoga', brief: 'An overview of common yoga styles (Hatha, Vinyasa, Ashtanga, Yin, Restorative, Kundalini) and how they differ.' },
    { slug: 'best-practices', title: 'Best Practices for Your Yoga Practice', brief: 'Practical guidance for getting the most out of a yoga practice — consistency, breath, listening to your body, hydration.' },
    { slug: 'benefits', title: 'Benefits of Yoga', brief: 'The general, well-established physical and mental benefits of a regular yoga practice.' },
    { slug: 'challenges', title: 'Common Challenges in Yoga (and How to Overcome Them)', brief: 'Common obstacles beginners and regular practitioners face — flexibility, time, consistency, plateaus — and constructive ways to work through them.' },
  ];
}

function extractText(raw: string): string {
  return raw.trim().replace(/^```(?:markdown|text)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

export async function run(): Promise<void> {
  const tenant = await db.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
  if (!tenant.rowCount) { console.log('[yoga-education-content] no tenant configured, skipping'); return; }
  const tenantId = tenant.rows[0].id;

  const admin = await db.query<{ id: string }>(`SELECT id FROM app_user WHERE tenant_id=$1 AND role IN ('admin','owner') AND status='active' LIMIT 1`, [tenantId]);
  const createdBy = admin.rows[0]?.id;
  if (!createdBy) { console.log('[yoga-education-content] no active admin app_user, skipping'); return; }

  const topics = await buildTopics();
  const formats = Object.keys(FORMAT_INSTRUCTIONS) as Format[];

  let created = 0;
  for (const topic of topics) {
    for (const format of formats) {
      // Idempotent per (topic, format, week) — never draft the same combo twice in one run/week.
      const weekOf = new Date().toISOString().slice(0, 10);
      const existing = await db.query(
        `SELECT id FROM social_content_draft WHERE tenant_id=$1 AND tags @> ARRAY[$2,$3,$4]::text[]`,
        [tenantId, topic.slug, format, `week-${weekOf}`],
      );
      if (existing.rowCount) continue;

      try {
        const prompt = `Topic: ${topic.title}\nContext: ${topic.brief}\n\nTask: ${FORMAT_INSTRUCTIONS[format]}`;
        const raw = await ollama.generate(prompt, {
          tier: 'strong',
          system: 'You write real, honest yoga-studio educational and marketing content. Never invent studio-specific statistics, ratings, classes, dates, or times that were not given to you — if a time or date is not provided, do not state one. Plain text or markdown only, no commentary about the task itself.',
          maxTokens: 500, timeoutMs: 90_000,
        });
        const text = extractText(raw);

        await db.query(
          `INSERT INTO social_content_draft (tenant_id, workspace_id, master_text, content_type, generated_with_ai, ai_prompt_used, ai_model, tags, created_by)
           VALUES ($1,$1,$2,$3,true,$4,'ollama/strong',$5::text[],$6)`,
          [tenantId, text, CONTENT_TYPE[format], prompt, [topic.slug, format, `week-${weekOf}`, topic.title], createdBy],
        );
        created++;
      } catch (err) {
        console.error(`[yoga-education-content] ${topic.slug}/${format}:`, err);
      }
    }
  }

  console.log(`[yoga-education-content] created=${created}/${topics.length * formats.length} drafts`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
