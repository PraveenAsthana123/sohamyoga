import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getPool } from '../src/lib/postgres';

async function main() {
  if (!process.env.DATABASE_URL) {
    const envText = await readFile(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const raw of envText.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const split = line.indexOf('=');
      if (split < 1) continue;
      const key = line.slice(0, split).trim();
      const value = line.slice(split + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      if (!process.env[key]) process.env[key] = value;
    }
  }
  // Created inline (not from db-schema-operations-alerts.sql) so a run failure
  // is trackable even on a completely fresh database, before that file runs.
  await getPool().query(`CREATE TABLE IF NOT EXISTS schema_migration_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), file_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('succeeded','failed')), error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

  for (const file of ['db-schema.sql','seed-phases.sql','db-schema-digital-marketing.sql','db-schema-operations-alerts.sql','db-schema-crm.sql','db-schema-checklist-templates.sql','seed-checklist-templates.sql','db-schema-hooks.sql','db-schema-voice-lead-link.sql','db-schema-service-catalog.sql','db-schema-research-library.sql','db-schema-intake.sql','db-schema-topic-intelligence.sql','db-schema-agency-client.sql','db-schema-meeting-reports.sql','db-schema-content-factory-medium.sql']) {
    const startedAt = new Date().toISOString();
    try {
      const sql = await readFile(path.join(process.cwd(),'src/domain/pipeline',file),'utf8');
      await getPool().query(sql);
      await getPool().query(
        `INSERT INTO schema_migration_run (file_name, status, started_at) VALUES ($1,'succeeded',$2)`,
        [file, startedAt],
      );
      console.log(`applied ${file}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await getPool().query(
        `INSERT INTO schema_migration_run (file_name, status, error_message, started_at) VALUES ($1,'failed',$2,$3)`,
        [file, message, startedAt],
      ).catch(() => {}); // best-effort — a broken DB connection means neither the migration nor this insert can succeed
      throw error;
    }
  }
  await getPool().end();
}
main().catch(error=>{ console.error(error); process.exit(1); });
