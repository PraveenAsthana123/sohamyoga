// WellnessScoringJob — Daily 03:00 UTC
// Calculates composite wellness score (0-100) from yesterday's journal entries.
// Uses Ollama fast model to interpret free-text mood notes.
//
// Rewritten against the live schema: practice_journal.entry_date not
// session_date, .notes not .session_notes, and there is no wellness_score_id
// link-back column on practice_journal at all — dedup is via wellness_score's
// own UNIQUE(student_id, score_date) instead. wellness_score has no
// sentiment/ai_note/source columns; score_method (VARCHAR(16), default
// 'auto') is the only provenance field, set to 'cron_ollama' here.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM_PROMPT = `You are a wellness analyst for a yoga studio.
Given a student's practice journal entry, return ONLY a JSON object:
{"mood_score": 1-10, "energy_score": 1-10, "sentiment": "positive"|"neutral"|"negative", "note": "one sentence summary"}
No other text. Numbers only for scores.`;

// Ollama commonly wraps JSON in ```json fences despite instructions not to —
// plain JSON.parse throws on that (confirmed live elsewhere this session).
function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

export async function run(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  // Yesterday's journal entries for students who don't already have a
  // wellness_score row for that date (UNIQUE(student_id, score_date)).
  const journals = await db.query<{
    id: string; student_id: string; tenant_id: string;
    mood_before: number | null; energy_level: number | null;
    notes: string | null; body_sensation: string[] | null;
  }>(`
    SELECT pj.id, pj.student_id, pj.tenant_id, pj.mood_before, pj.energy_level, pj.notes, pj.body_sensation
    FROM practice_journal pj
    WHERE pj.entry_date = $1
      AND NOT EXISTS (
        SELECT 1 FROM wellness_score ws WHERE ws.student_id = pj.student_id AND ws.score_date = $1
      )
  `, [dateStr]);

  let scored = 0;

  for (const j of journals.rows) {
    try {
      const context = [
        // practice_journal.mood_before/energy_level are constrained 1-5
        // (chk_journal_mood_before/chk_journal_energy) — not 1-10. Ollama is
        // still asked to output mood_score/energy_score on its own 1-10
        // scale per SYSTEM_PROMPT; only the input label was wrong.
        j.mood_before    != null ? `Mood before: ${j.mood_before}/5` : null,
        j.energy_level   != null ? `Energy: ${j.energy_level}/5` : null,
        j.notes          ? `Notes: ${j.notes}` : null,
        j.body_sensation?.length ? `Body sensation: ${j.body_sensation.join(', ')}` : null,
      ].filter(Boolean).join('\n');

      if (!context) continue;

      const raw = await ollama.generate(context, { tier: 'fast', system: SYSTEM_PROMPT, maxTokens: 150 });

      let parsed: { mood_score: number; energy_score: number; sentiment: string; note: string };
      try {
        parsed = extractJson(raw);
      } catch (parseErr) {
        console.error(`[wellness-scoring] student ${j.student_id}: unparseable Ollama response:`, parseErr);
        continue;
      }

      const mood   = Math.max(1, Math.min(10, parsed.mood_score   ?? j.mood_before   ?? 5));
      const energy = Math.max(1, Math.min(10, parsed.energy_score ?? j.energy_level  ?? 5));
      // Composite: mood 40% + energy 40% + sleep placeholder 20% (no real
      // sleep signal exists yet — 5/10 is the neutral midpoint, not a guess
      // at a real value).
      const composite = Math.round(mood * 4 + energy * 4 + 5 * 2);

      await db.query(
        `INSERT INTO wellness_score (student_id, tenant_id, score_date, composite_score, mood_score, energy_score, score_method)
         VALUES ($1,$2,$3,$4,$5,$6,'cron_ollama')
         ON CONFLICT (student_id, score_date) DO NOTHING`,
        [j.student_id, j.tenant_id, dateStr, composite, mood, energy],
      );

      scored++;
    } catch (err) {
      console.error(`[wellness-scoring] student ${j.student_id}:`, err);
    }
  }

  console.log(`[wellness-scoring] ${dateStr}: scored=${scored}/${journals.rows.length}`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
