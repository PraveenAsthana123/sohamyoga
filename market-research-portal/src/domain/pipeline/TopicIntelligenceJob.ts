// Topic Intelligence Engine: the source conversation asked for "trend/comment/
// competitor signal ingestion," but this app has no social-listening API or
// credential to pull real external trend data from. Rather than fabricate
// trend numbers, this job mines the real signals the app already has:
// competitor entries/features, real lead inquiry messages, and real hook
// performance from content_factory_metric. A quiet day with no leads or
// competitors produces zero signal rows — never an invented topic.
import { query } from '../../lib/postgres';

const STOPWORDS = new Set([
  'the','a','an','and','or','but','is','are','was','were','be','been','to','of','in','on',
  'for','with','at','by','from','up','about','into','over','after','i','you','we','they',
  'it','this','that','my','your','our','their','have','has','had','do','does','did','will',
  'would','can','could','should','not','no','yes','me','us','them','he','she','him','her',
]);

function extractKeywords(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));
}

interface Workspace { id: string }

async function upsertSignal(workspaceId: string, topic: string, source: string, strength: number, detail: string) {
  await query(
    `INSERT INTO topic_signal (workspace_id, topic, source, signal_strength, detail)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (workspace_id, topic, source, captured_on)
     DO UPDATE SET signal_strength = EXCLUDED.signal_strength, detail = EXCLUDED.detail`,
    [workspaceId, topic, source, strength, detail],
  );
}

export async function run(): Promise<{ signalsWritten: number }> {
  const workspaces = await query<Workspace>(`SELECT id FROM marketing_workspace`);
  let written = 0;

  for (const w of workspaces.rows) {
    // Source 1: competitor names/features — real entries an admin recorded.
    const competitors = await query<{ name: string; feature_value: string | null }>(
      `SELECT c.name, cf.feature_value FROM competitor c
       LEFT JOIN competitor_feature cf ON cf.competitor_id = c.id`,
    );
    const competitorCounts = new Map<string, number>();
    for (const row of competitors.rows) {
      for (const kw of extractKeywords(`${row.name} ${row.feature_value || ''}`)) {
        competitorCounts.set(kw, (competitorCounts.get(kw) || 0) + 1);
      }
    }
    for (const [topic, count] of competitorCounts) {
      if (count < 2) continue;
      await upsertSignal(w.id, topic, 'competitor', count, `Mentioned in ${count} competitor record(s).`);
      written++;
    }

    // Source 2: real lead inquiry messages for this workspace.
    const leads = await query<{ message: string }>(
      `SELECT message FROM lead WHERE workspace_id = $1 AND message IS NOT NULL AND message <> ''`,
      [w.id],
    );
    const leadCounts = new Map<string, number>();
    for (const row of leads.rows) {
      for (const kw of extractKeywords(row.message)) {
        leadCounts.set(kw, (leadCounts.get(kw) || 0) + 1);
      }
    }
    for (const [topic, count] of leadCounts) {
      if (count < 2) continue;
      await upsertSignal(w.id, topic, 'lead_message', count, `Appeared in ${count} lead inquiry message(s).`);
      written++;
    }

    // Source 3: hooks whose real attached-variant performance is actually
    // measured (never hooks with zero views — that would rank silence as a
    // signal).
    const hookPerf = await query<{ topic: string; completion_rate_pct: string | null; total_views: string }>(
      `SELECT h.topic,
              round(sum(m.completions)::numeric / NULLIF(sum(m.views), 0) * 100, 1) AS completion_rate_pct,
              sum(m.views) AS total_views
       FROM content_hook h
       JOIN content_factory_variant v ON v.hook_id = h.id
       JOIN content_factory_metric m ON m.variant_id = v.id
       WHERE h.workspace_id = $1 AND h.topic IS NOT NULL
       GROUP BY h.topic
       HAVING sum(m.views) > 0`,
      [w.id],
    );
    for (const row of hookPerf.rows) {
      const pct = Number(row.completion_rate_pct ?? 0);
      await upsertSignal(w.id, row.topic, 'hook_performance', Math.round(pct), `${pct}% completion rate across ${row.total_views} real views.`);
      written++;
    }
  }

  return { signalsWritten: written };
}
