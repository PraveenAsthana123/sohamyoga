// Module Registry Drift Sweep — mandatory monitoring job per the Module
// Understanding Standard policy. Real, deterministic, no AI: flags registry
// rows that are stale (not reverified in 30 days) or incomplete (missing
// required flow/schema fields for anything claimed 'real' or 'partial').
// Does NOT flag 'not_yet_cataloged'/'not_built' rows as incomplete — those
// are honestly queued work, not drift.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface Row {
  id: string; app: string; module_key: string; name: string; built_status: string;
  user_flow: string | null; admin_flow: string | null; schema_tables: string[];
  last_verified_at: string | null;
}

const REQUIRED_IF_CLAIMED_BUILT = ['user_flow', 'admin_flow'] as const;

export async function run(): Promise<void> {
  const rows = await db.query<Row>(`SELECT id, app, module_key, name, built_status, user_flow, admin_flow, schema_tables, last_verified_at FROM module_registry`);

  const stale = rows.rows.filter(r => !r.last_verified_at || Date.now() - new Date(r.last_verified_at).getTime() > 30 * 24 * 60 * 60 * 1000);
  const incomplete = rows.rows.filter(r =>
    ['real', 'partial'].includes(r.built_status) &&
    REQUIRED_IF_CLAIMED_BUILT.some(field => !(r as any)[field]),
  );

  console.log(`[module-registry-drift-sweep] ${stale.length} stale (>30d unverified), ${incomplete.length} incomplete (claimed real/partial but missing user_flow/admin_flow)${incomplete.length ? ': ' + incomplete.map(r => `${r.app}/${r.module_key}`).join(', ') : ''}`);
}
