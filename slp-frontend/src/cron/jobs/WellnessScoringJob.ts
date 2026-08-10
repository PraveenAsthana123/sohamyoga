// WellnessScoringJob — Daily 03:00 UTC
// Calculates composite wellness score (0-100) from yesterday's journal entries.
// Uses Ollama fast model to interpret free-text mood notes.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM_PROMPT = `You are a wellness analyst for a yoga studio.
Given a student's practice journal entry, return ONLY a JSON object:
{"mood_score": 1-10, "energy_score": 1-10, "sentiment": "positive"|"neutral"|"negative", "note": "one sentence summary"}
No other text. Numbers only for scores.`;

export async function run(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  // Fetch yesterday's journal entries that have not been scored
  const journals = await db.query<{
    id: string; student_id: string; tenant_id: string;
    mood_before: number | null; energy_level: number | null;
    session_notes: string | null; body_sensation: string | null;
  }>(`
    SELECT id, student_id, tenant_id, mood_before, energy_level, session_notes, body_sensation
    FROM practice_journal
    WHERE DATE(session_date) = $1
      AND wellness_score_id IS NULL
  `, [dateStr]);

  let scored = 0;

  for (const j of journals.rows) {
    try {
      // Compose context for Ollama
      const context = [
        j.mood_before    != null ? `Mood before: ${j.mood_before}/10` : null,
        j.energy_level   != null ? `Energy: ${j.energy_level}/10` : null,
        j.session_notes  ? `Notes: ${j.session_notes}` : null,
        j.body_sensation ? `Body sensation: ${j.body_sensation}` : null,
      ].filter(Boolean).join('\n');

      if (!context) continue;

      const raw = await ollama.generate(context, { tier: 'fast', system: SYSTEM_PROMPT, maxTokens: 150 });

      let parsed: { mood_score: number; energy_score: number; sentiment: string; note: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue; // skip unparseable
      }

      // Clamp scores
      const mood   = Math.max(1, Math.min(10, parsed.mood_score   ?? j.mood_before   ?? 5));
      const energy = Math.max(1, Math.min(10, parsed.energy_score ?? j.energy_level  ?? 5));

      // Composite score: mood 40% + energy 40% + sleep placeholder 20%
      const composite = Math.round((mood * 4 + energy * 4 + 5 * 2));

      // Insert wellness_score row
      const ws = await db.query<{ id: string }>(`
        INSERT INTO wellness_score
          (student_id, tenant_id, score_date, composite_score, mood_score, energy_score,
           sentiment, ai_note, source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'cron_ollama')
        RETURNING id
      `, [j.student_id, j.tenant_id, dateStr, composite, mood, energy,
          parsed.sentiment, parsed.note]);

      // Link back to journal
      await db.query(`
        UPDATE practice_journal SET wellness_score_id = $1 WHERE id = $2
      `, [ws.rows[0].id, j.id]);

      scored++;
    } catch (err) {
      console.error(`[wellness-scoring] student ${j.student_id}:`, err);
    }
  }

  console.log(`[wellness-scoring] ${dateStr}: scored=${scored}/${journals.rows.length}`);
  await db.end();
}
