// Unified db.ts — re-exports the singleton pool from postgres.ts so that
// files using `import { pool } from '@/lib/db'` continue to work.
import { Pool } from 'pg';
import { getPool } from './postgres';

// Export a proxy-style `pool` object that forwards every call to the
// singleton pool created by getPool().  We use a Proxy so the object is
// always safe to import at module-evaluation time (before env-vars are
// checked) — the real pool is only created on the first actual query.
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const realPool = getPool();
    const value = (realPool as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(realPool);
    }
    return value;
  },
});
