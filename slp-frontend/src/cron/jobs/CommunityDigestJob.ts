// CommunityDigestJob — Weekly Monday 09:00 UTC
// AI-generates a community activity digest: top achievers, leaderboard movers, new badges.
// Uses Ollama fast model. Stored as in_app notification for all active students.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM = `You are a community manager for a yoga studio.
Write a short, warm community digest message (max 150 words).
Celebrate achievements enthusiastically. Use emojis sparingly.
Return plain text only.`;

export async function run(): Promise<void> {
  const weekOf = new Date().toISOString().split('T')[0];

  const [topStudents, newBadges, milestoneCount] = await Promise.all([
    db.query<{ first_name: string; total_xp: number }>(`
      SELECT s.first_name, le.total_xp
      FROM leaderboard_entry le
      JOIN student s ON s.id=le.student_id
      WHERE le.period_type='weekly'
        AND le.period_key=TO_CHAR(NOW(),'IYYY-IW')
      ORDER BY le.rank ASC LIMIT 3
    `),
    db.query<{ count: string }>(`
      SELECT COUNT(*) FROM achievement
      WHERE earned_at >= NOW() - INTERVAL '7 days'
    `),
    db.query<{ count: string }>(`
      SELECT COUNT(*) FROM milestone
      WHERE status='earned' AND earned_at >= NOW() - INTERVAL '7 days'
    `),
  ]);

  const prompt = [
    `Top students this week: ${topStudents.rows.map((s, i) => `${i+1}. ${s.first_name} (${s.total_xp} XP)`).join(', ')}`,
    `New badges awarded: ${newBadges.rows[0]?.count ?? 0}`,
    `Milestones reached: ${milestoneCount.rows[0]?.count ?? 0}`,
  ].join('\n');

  const digest = await ollama.generate(prompt, {
    tier: 'fast', system: SYSTEM, maxTokens: 300, timeoutMs: 30_000,
  });

  // Queue as in_app broadcast for all active students
  const tenants = await db.query<{ id: string }>(`SELECT DISTINCT tenant_id AS id FROM student WHERE status='active'`);

  for (const t of tenants.rows) {
    await db.query(`
      INSERT INTO notification_queue
        (tenant_id, recipient_id, channel, template_slug, payload, idempotency_key)
      SELECT $1, s.id, 'in_app', 'community_digest',
        jsonb_build_object('digest', $2, 'week', $3),
        'digest_' || s.id || '_' || $3
      FROM student s
      WHERE s.tenant_id=$1 AND s.status='active'
      ON CONFLICT (idempotency_key) DO NOTHING
    `, [t.id, digest, weekOf]);
  }

  console.log(`[community-digest] week=${weekOf} digest generated and queued`);
  await db.end();
}
