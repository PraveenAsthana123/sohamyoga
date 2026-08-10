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

export async function run(): Promise<void> {
  const weekOf = new Date().toISOString().split('T')[0];

  // Gather context from the past week
  const [posts, events, milestones] = await Promise.all([
    db.query<{ title: string; summary: string }>(`
      SELECT title, LEFT(body, 200) AS summary FROM blog_post
      WHERE published_at >= NOW() - INTERVAL '7 days'
      ORDER BY published_at DESC LIMIT 3
    `),
    db.query<{ title: string; start_date: string }>(`
      SELECT title, start_date::text FROM event
      WHERE start_date >= NOW() AND start_date <= NOW() + INTERVAL '14 days'
      ORDER BY start_date LIMIT 5
    `),
    db.query<{ count: string }>(`
      SELECT COUNT(*) FROM milestone WHERE status='earned'
        AND DATE(earned_at) >= NOW() - INTERVAL '7 days'
    `),
  ]);

  const context = [
    posts.rows.length > 0
      ? `Recent blog posts:\n${posts.rows.map(p => `- ${p.title}: ${p.summary}`).join('\n')}`
      : 'No new blog posts this week.',
    events.rows.length > 0
      ? `Upcoming events:\n${events.rows.map(e => `- ${e.title} on ${e.start_date}`).join('\n')}`
      : 'No upcoming events.',
    `Milestones earned by students this week: ${milestones.rows[0]?.count ?? 0}`,
  ].join('\n\n');

  const html = await ollama.generate(context, {
    tier:      'strong',
    system:    SYSTEM,
    maxTokens: 1500,
    timeoutMs: 120_000,
  });

  const idempotencyKey = `newsletter_draft_${weekOf}`;

  // Store as draft template — requires staff to approve before Listmonk send
  await db.query(`
    INSERT INTO notification_template
      (tenant_id, slug, name, channel, notification_type, body, status, version,
       is_ai_generated, created_at, updated_at)
    VALUES (
      (SELECT id FROM tenant LIMIT 1),
      $1, $2, 'email', 'marketing', $3, 'draft', 1, true, NOW(), NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
      body=$3, status='draft', version=notification_template.version+1,
      is_ai_generated=true, updated_at=NOW()
  `, [idempotencyKey,
      `Weekly Newsletter — ${weekOf}`,
      html]);

  console.log(`[newsletter-draft] week=${weekOf} draft saved (pending staff approval)`);
  await db.end();
}
