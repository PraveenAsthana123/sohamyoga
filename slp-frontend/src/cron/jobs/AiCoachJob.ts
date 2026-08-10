// AiCoachJob — Daily 05:00 UTC
// Generates personalized class + pose recommendations per student.
// Uses Ollama strong model. Output stored as DRAFT — never auto-publishes to student.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM = `You are an expert yoga coach AI. Given a student profile,
return ONLY valid JSON — no markdown, no explanation:
{
  "recommended_class_types": ["string", ...],   // max 3
  "focus_poses": ["Sanskrit name", ...],         // max 5
  "avoid_poses": ["Sanskrit name", ...],         // max 3 (contraindications)
  "practice_tip": "one motivational sentence",
  "session_duration_min": 30|45|60|90
}`;

export async function run(): Promise<void> {
  // Students who haven't received a recommendation today
  const students = await db.query<{
    student_id: string; tenant_id: string;
    yoga_goals: string[]; health_notes: string | null;
    current_streak: number; last_class_type: string | null;
    journey_phase: string; wellness_avg: number | null;
  }>(`
    SELECT
      s.id AS student_id,
      s.tenant_id,
      ARRAY_AGG(DISTINCT g.goal_type) FILTER (WHERE g.goal_type IS NOT NULL) AS yoga_goals,
      s.health_notes,
      COALESCE(st.current_streak, 0) AS current_streak,
      (SELECT class_type FROM attendance_record ar
       JOIN enrollment e ON e.id=ar.enrollment_id
       WHERE ar.student_id=s.id ORDER BY ar.date DESC LIMIT 1) AS last_class_type,
      s.journey_phase,
      (SELECT AVG(composite_score) FROM wellness_score ws
       WHERE ws.student_id=s.id
         AND ws.score_date >= NOW() - INTERVAL '7 days') AS wellness_avg
    FROM student s
    LEFT JOIN student_goal g ON g.student_id = s.id
    LEFT JOIN streak st ON st.student_id = s.id AND st.is_active = true
    WHERE s.status = 'active'
      AND s.id NOT IN (
        SELECT recipient_id FROM notification_queue
        WHERE template_slug = 'ai_coach_recommendation'
          AND DATE(created_at) = CURRENT_DATE
      )
    GROUP BY s.id, s.tenant_id, s.health_notes, st.current_streak,
             s.journey_phase
    LIMIT 100
  `);

  let generated = 0;

  for (const s of students.rows) {
    try {
      const prompt = [
        `Phase: ${s.journey_phase}`,
        `Goals: ${(s.yoga_goals ?? []).join(', ') || 'general wellness'}`,
        `Streak: ${s.current_streak} days`,
        `Last class: ${s.last_class_type ?? 'unknown'}`,
        `7-day wellness avg: ${s.wellness_avg ? Math.round(s.wellness_avg) : 'no data'}/100`,
        s.health_notes ? `Health notes: ${s.health_notes}` : null,
      ].filter(Boolean).join('\n');

      const raw = await ollama.generate(prompt, {
        tier:      'strong',
        system:    SYSTEM,
        maxTokens: 400,
        timeoutMs: 30_000,
      });

      let rec: Record<string, unknown>;
      try { rec = JSON.parse(raw); } catch { continue; }

      // Store as ai_coach_recommendation (DRAFT — human-visible but not pushed yet)
      await db.query(`
        INSERT INTO ai_recommendation
          (student_id, tenant_id, rec_date, recommendation_json, model_used, status)
        VALUES ($1, $2, CURRENT_DATE, $3, $4, 'draft')
        ON CONFLICT (student_id, rec_date) DO UPDATE
          SET recommendation_json=$3, model_used=$4, status='draft', updated_at=NOW()
      `, [s.student_id, s.tenant_id, JSON.stringify(rec), 'ollama/strong']);

      generated++;
    } catch (err) {
      console.error(`[ai-coach] student ${s.student_id}:`, err);
    }
  }

  console.log(`[ai-coach] generated=${generated}/${students.rows.length} recommendations`);
  await db.end();
}
