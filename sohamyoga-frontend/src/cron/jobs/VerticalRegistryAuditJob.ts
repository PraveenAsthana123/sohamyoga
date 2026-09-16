// VerticalRegistryAuditJob — weekly Sunday 5am
// Audits the vertical_pack table: checks which verticals are stale
// (no associated kpi_snapshot activity in the last 30 days),
// and logs a warning for any vertical whose real_kpi_dimensions list
// no longer matches what is actually present in kpi_snapshot.
// Results are written to the job_log table (if present).

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SCHEDULE = '0 5 * * 0'; // weekly Sunday 5am

export async function run(): Promise<void> {
  let verticals = 0;
  let stale = 0;
  let dimensionMismatches = 0;

  try {
    const packs = await db.query<{
      id: string; vertical_key: string; name: string; real_kpi_dimensions: string[];
    }>(`SELECT id, vertical_key, name, real_kpi_dimensions FROM vertical_pack`);

    verticals = packs.rows.length;

    for (const pack of packs.rows) {
      // Check for recent kpi_snapshot activity for this vertical.
      try {
        const activity = await db.query(
          `SELECT 1 FROM kpi_snapshot
           WHERE dimension_key = ANY($1::text[])
             AND snapshot_date >= now() - INTERVAL '30 days'
           LIMIT 1`,
          [pack.real_kpi_dimensions],
        );
        if ((activity.rowCount ?? 0) === 0) {
          stale++;
          console.warn(`[vertical-registry-audit] STALE vertical=${pack.vertical_key} — no kpi_snapshot in 30 days`);
        }
      } catch {
        // kpi_snapshot may not have the expected columns — non-fatal.
      }

      // Check that claimed KPI dimensions actually exist in kpi_snapshot.
      if (pack.real_kpi_dimensions.length > 0) {
        try {
          const dims = await db.query<{ dimension_key: string }>(
            `SELECT DISTINCT dimension_key FROM kpi_snapshot WHERE dimension_key = ANY($1::text[])`,
            [pack.real_kpi_dimensions],
          );
          const foundKeys = new Set(dims.rows.map(r => r.dimension_key));
          const missing = pack.real_kpi_dimensions.filter(d => !foundKeys.has(d));
          if (missing.length > 0) {
            dimensionMismatches++;
            console.warn(`[vertical-registry-audit] MISMATCH vertical=${pack.vertical_key} missing_dims=${missing.join(',')}`);
          }
        } catch {
          // Non-fatal.
        }
      }
    }
  } catch (err) {
    console.error('[vertical-registry-audit] Error querying vertical_pack:', err);
  }

  console.log(`[vertical-registry-audit] verticals=${verticals} stale=${stale} mismatches=${dimensionMismatches} schedule=${SCHEDULE}`);

  // Log run result to job_log if the table exists.
  try {
    await db.query(
      `INSERT INTO job_log (job_name, ran_at, result)
       VALUES ('VerticalRegistryAuditJob', now(), $1)`,
      [JSON.stringify({ verticals, stale, dimensionMismatches })],
    );
  } catch {
    // Non-fatal.
  }

  // Do NOT db.end() — pool is shared across the cron process lifetime.
}
