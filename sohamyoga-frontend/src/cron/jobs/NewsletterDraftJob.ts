// NewsletterDraftJob — Weekly Monday 08:00 UTC
// AI-drafts the weekly newsletter from recent blog posts, events, and milestones.
// Output stored as DRAFT in notification_template — requires staff approval to send.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM = `You are a yoga studio newsletter writer.
Write a warm, inclusive weekly email newsletter in HTML format.
Use the studio name "Soham Yoga".
Tone: warm, inspiring, mindful.
Structure: greeting → weekly highlight → upcoming events → tip of the week → CTA.
Keep it under 400 words. Return HTML only, no markdown code fences.`;

// No `blog_post` or `event` table exists anywhere in this database — the
// public blog is served from a separate system (the .NET backend, reached
// via next.config.js's fallback rewrite), not this Postgres instance, and
// there is no studio-events concept here at all. Dropped the blog section
// entirely rather than query a relation that doesn't exist; "upcoming
// events" is replaced with real upcoming class_session rows, the closest
// actually-existing data to that concept.
export async function run(): Promise<void> {
  const weekOf = new Date().toISOString().split('T')[0];

  const [classes, milestones] = await Promise.all([
    db.query<{ class_name: string; session_date: string; start_time: string }>(`
      SELECT class_name, session_date::text, start_time::text FROM class_session
      WHERE session_date >= CURRENT_DATE AND session_date <= CURRENT_DATE + INTERVAL '14 days'
        AND status = 'scheduled'
      ORDER BY session_date, start_time LIMIT 5
    `),
    db.query<{ count: string }>(`
      SELECT COUNT(*) FROM milestone WHERE status='earned'
        AND DATE(earned_at) >= NOW() - INTERVAL '7 days'
    `),
  ]);

  const context = [
    classes.rows.length > 0
      ? `Upcoming classes:\n${classes.rows.map(c => `- ${c.class_name} on ${c.session_date} at ${c.start_time}`).join('\n')}`
      : 'No upcoming classes scheduled in the next two weeks.',
    `Milestones earned by students this week: ${milestones.rows[0]?.count ?? 0}`,
  ].join('\n\n');

  const html = await ollama.generate(context, {
    tier:      'strong',
    system:    SYSTEM,
    maxTokens: 1500,
    timeoutMs: 120_000,
  });

  const slug = `newsletter_draft_${weekOf}`;
  const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000';

  // Store as draft template — requires staff to approve before Listmonk send.
  // Real columns: type (not notification_type), no is_ai_generated column,
  // created_by is NOT NULL with no default, unique key is
  // (tenant_id, slug, locale) not slug alone. chk_template_email_subj also
  // requires a non-null subject whenever channel='email'.
  await db.query(`
    INSERT INTO notification_template
      (tenant_id, slug, name, channel, type, subject, body, status, version, created_by, created_at, updated_at)
    VALUES (
      (SELECT id FROM tenant LIMIT 1),
      $1, $2, 'email', 'marketing', $2, $3, 'draft', 1, $4, NOW(), NOW()
    )
    ON CONFLICT (tenant_id, slug, locale) DO UPDATE SET
      body=$3, status='draft', version=notification_template.version+1, updated_at=NOW()
  `, [slug, `Weekly Newsletter — ${weekOf}`, html, SYSTEM_ACTOR]);

  console.log(`[newsletter-draft] week=${weekOf} draft saved (pending staff approval)`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
