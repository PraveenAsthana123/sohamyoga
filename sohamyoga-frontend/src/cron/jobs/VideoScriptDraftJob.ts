// VideoScriptDraftJob — Daily 06:00 UTC
// Generates AI video script + hook lines for draft video assets that have no
// script yet. Uses Ollama strong model. All output saved as DRAFT
// (script_status='draft') — never auto-approved.

import { Pool } from 'pg';
import { generateVideoScript } from '@/domain/video/VideoScriptGenerator';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  const rows = await db.query<{
    id: string; title: string; description: string; tags: string[];
  }>(`SELECT id, title, description, tags FROM video_asset WHERE script_status = 'none' AND status = 'draft' LIMIT 5`);

  let drafted = 0;

  for (const row of rows.rows) {
    try {
      const parsed = await generateVideoScript({ title: row.title, description: row.description, tags: row.tags ?? [] });
      if (!parsed) {
        console.error(`[video-script-draft] asset ${row.id}: invalid or unparseable Ollama response`);
        continue;
      }

      await db.query(
        `UPDATE video_asset SET script = $1, hook_lines = $2, script_status = 'draft' WHERE id = $3`,
        [parsed.script, parsed.hooks, row.id],
      );
      drafted++;
    } catch (err) {
      console.error(`[video-script-draft] asset ${row.id}:`, err);
    }
  }

  console.log(`[video-script-draft] drafted=${drafted}/${rows.rows.length} scripts`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
