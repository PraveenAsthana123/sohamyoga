// AiCoachJob — Daily 05:00 UTC
// Generates personalized class + pose recommendations per student.
// Uses Ollama strong model. Output stored as DRAFT — never auto-publishes to student.
//
// Rewritten against the live schema: student has no health_notes column;
// student_goal keys on goal_code, not goal_type; streak keys off user_id
// with no is_active column; attendance_record has no class_type/enrollment
// join path for "last class" (real path: attendance_record.class_session_id
// -> class_session.class_name); notification_queue needs recipient_user_id;
// ai_recommendation didn't exist as a table at all (added this session,
// see db-schema-ai-recommendation.sql).

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

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

export async function run(): Promise<void> {
  const students = await db.query<{
    student_id: string; tenant_id: string; user_id: string;
    yoga_goals: string[]; current_streak: number; last_class_name: string | null;
    journey_phase: string; wellness_avg: number | null;
  }>(`
    SELECT
      s.id AS student_id,
      s.tenant_id,
      s.user_id,
      ARRAY_AGG(DISTINCT g.goal_code) FILTER (WHERE g.goal_code IS NOT NULL) AS yoga_goals,
      COALESCE(st.current_streak, 0) AS current_streak,
      (SELECT cs.class_name FROM attendance_record ar
       JOIN class_session cs ON cs.id = ar.class_session_id
       WHERE ar.student_id = s.id ORDER BY ar.attended_at DESC NULLS LAST LIMIT 1) AS last_class_name,
      s.journey_phase,
      (SELECT AVG(composite_score) FROM wellness_score ws
       WHERE ws.student_id = s.id AND ws.score_date >= NOW() - INTERVAL '7 days') AS wellness_avg
    FROM student s
    LEFT JOIN student_goal g ON g.student_id = s.id
    LEFT JOIN streak st ON st.user_id = s.user_id
    WHERE s.status = 'active'
      AND s.id NOT IN (
        SELECT ar.student_id FROM ai_recommendation ar WHERE ar.rec_date = CURRENT_DATE
      )
    GROUP BY s.id, s.tenant_id, s.user_id, st.current_streak, s.journey_phase
    LIMIT 100
  `);

  let generated = 0;

  for (const s of students.rows) {
    try {
      const prompt = [
        `Phase: ${s.journey_phase}`,
        `Goals: ${(s.yoga_goals ?? []).join(', ') || 'general wellness'}`,
        `Streak: ${s.current_streak} days`,
        `Last class: ${s.last_class_name ?? 'unknown'}`,
        `7-day wellness avg: ${s.wellness_avg ? Math.round(s.wellness_avg) : 'no data'}/100`,
      ].filter(Boolean).join('\n');

      const raw = await ollama.generate(prompt, { tier: 'strong', system: SYSTEM, maxTokens: 400, timeoutMs: 30_000 });

      let rec: Record<string, unknown>;
      try { rec = extractJson(raw); } catch (parseErr) {
        console.error(`[ai-coach] student ${s.student_id}: unparseable Ollama response:`, parseErr);
        continue;
      }

      await db.query(
        `INSERT INTO ai_recommendation (student_id, tenant_id, rec_date, recommendation_json, model_used, status)
         VALUES ($1,$2,CURRENT_DATE,$3,$4,'draft')
         ON CONFLICT (student_id, rec_date) DO UPDATE
           SET recommendation_json=$3, model_used=$4, status='draft', updated_at=NOW()`,
        [s.student_id, s.tenant_id, JSON.stringify(rec), 'ollama/strong'],
      );

      generated++;
    } catch (err) {
      console.error(`[ai-coach] student ${s.student_id}:`, err);
    }
  }

  console.log(`[ai-coach] generated=${generated}/${students.rows.length} recommendations`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
