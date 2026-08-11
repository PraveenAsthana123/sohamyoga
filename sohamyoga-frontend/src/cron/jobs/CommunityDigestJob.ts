// CommunityDigestJob — Weekly Monday 09:00 UTC
// AI-generates a community activity digest: top achievers, leaderboard movers, new badges.
// Uses Ollama fast model. Stored as in_app notification for all active students.
//
// Rewritten against the live schema: leaderboard_entry keys off user_id with
// columns board_type/board_period/score (not student_id/period_type/
// period_key/total_xp — matches LeaderboardRefreshJob's real schema, fixed
// earlier this session); student has no first_name column, only
// display_name; achievement/milestone use user_id-space ids consistently
// with the rest of the gamification domain; notification_queue needs
// recipient_user_id/recipient_address/type.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM = `You are a community manager for a yoga studio.
Write a short, warm community digest message (max 150 words).
Celebrate achievements enthusiastically. Use emojis sparingly.
Return plain text only.`;

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function run(): Promise<void> {
  const weekOf = new Date().toISOString().split('T')[0];
  const boardPeriod = isoWeek(new Date());

  const [topStudents, newBadges, milestoneCount] = await Promise.all([
    db.query<{ display_name: string; score: number }>(
      `SELECT le.display_name, le.score FROM leaderboard_entry le
       WHERE le.board_type = 'xp' AND le.board_period = $1
       ORDER BY le.rank ASC LIMIT 3`,
      [boardPeriod],
    ),
    db.query<{ count: string }>(`SELECT COUNT(*) FROM achievement WHERE earned_at >= NOW() - INTERVAL '7 days'`),
    db.query<{ count: string }>(`SELECT COUNT(*) FROM milestone WHERE status='earned' AND earned_at >= NOW() - INTERVAL '7 days'`),
  ]);

  const prompt = [
    `Top students this week: ${topStudents.rows.map((s, i) => `${i + 1}. ${s.display_name} (${s.score} XP)`).join(', ') || 'none yet'}`,
    `New badges awarded: ${newBadges.rows[0]?.count ?? 0}`,
    `Milestones reached: ${milestoneCount.rows[0]?.count ?? 0}`,
  ].join('\n');

  const digest = await ollama.generate(prompt, { tier: 'fast', system: SYSTEM, maxTokens: 300, timeoutMs: 30_000 });

  const students = await db.query<{ id: string; tenant_id: string; user_id: string; email: string }>(
    `SELECT id, tenant_id, user_id, email FROM student WHERE status = 'active'`,
  );

  let queued = 0;
  for (const s of students.rows) {
    const result = await db.query(
      `INSERT INTO notification_queue
         (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
       VALUES ($1,'community_digest','in_app','marketing',$2,$3,$4,$5)
       ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
       RETURNING id`,
      [s.tenant_id, s.user_id, s.email, JSON.stringify({ digest, week: weekOf }), `digest_${s.id}_${weekOf}`],
    );
    if (result.rows.length) queued++;
  }

  console.log(`[community-digest] week=${weekOf} digest generated, queued=${queued}/${students.rows.length}`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
