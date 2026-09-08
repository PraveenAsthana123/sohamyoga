// Real, deterministic wellness_score computation from actual practice_journal
// entries -- never fabricated. score_method='auto' matches the table's own
// documented convention ("'auto' (from daily log), 'manual'"). Only
// mood_score and energy_score are populated (from mood_after/energy_level,
// the two fields this app actually collects); sleep/activity/mindfulness
// stay null since nothing here measures them -- the composite score is
// computed only from the components that are genuinely real.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  const entries = await db.query<{
    tenant_id: string; student_id: string; entry_date: string; mood_after: number | null; energy_level: number | null;
  }>(
    `SELECT DISTINCT ON (pj.student_id, pj.entry_date) pj.tenant_id, pj.student_id, pj.entry_date::text, pj.mood_after, pj.energy_level
     FROM practice_journal pj
     LEFT JOIN wellness_score ws ON ws.student_id = pj.student_id AND ws.score_date = pj.entry_date
     WHERE ws.id IS NULL AND (pj.mood_after IS NOT NULL OR pj.energy_level IS NOT NULL)
     ORDER BY pj.student_id, pj.entry_date, pj.created_at DESC`,
  );

  let computed = 0;
  for (const e of entries.rows) {
    const moodScore = e.mood_after !== null ? e.mood_after * 2 : null;
    const energyScore = e.energy_level !== null ? e.energy_level * 2 : null;
    const components = [moodScore, energyScore].filter((v): v is number => v !== null);
    if (!components.length) continue;
    const composite = Math.round((components.reduce((a, b) => a + b, 0) / components.length) * 10);

    await db.query(
      `INSERT INTO wellness_score (tenant_id, student_id, score_date, mood_score, energy_score, composite_score, score_method)
       VALUES ($1,$2,$3,$4,$5,$6,'auto')
       ON CONFLICT (student_id, score_date) DO UPDATE SET
         mood_score = EXCLUDED.mood_score, energy_score = EXCLUDED.energy_score, composite_score = EXCLUDED.composite_score
       WHERE wellness_score.score_method = 'auto'`,
      [e.tenant_id, e.student_id, e.entry_date, moodScore, energyScore, composite],
    );
    computed++;
  }
  console.log(`[wellness-score-compute] candidate_days=${entries.rows.length} computed=${computed}`);
  // Do NOT db.end() -- cached module, reused across every scheduled invocation.
}
