import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

const globalForDb = globalThis as unknown as { mrpPool?: Pool; mrpRoPool?: Pool };

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** This app's own database (market_research_portal) — full read/write. */
export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!globalForDb.mrpPool) {
    globalForDb.mrpPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalForDb.mrpPool;
}

/**
 * Explicitly READ-ONLY cross-DB connection into sohamyoga's existing
 * database, via the `sohamyoga_ro` role (GRANT SELECT only — verified live
 * that INSERT/CREATE TABLE are both denied for this role). Used ONLY by
 * PricingCrossPortalJob and ReviewsCrossPortalJob. Never write through
 * this pool.
 */
export function getSohamyogaReadOnlyPool(): Pool | null {
  if (!process.env.SOHAMYOGA_RO_DATABASE_URL) return null;
  if (!globalForDb.mrpRoPool) {
    globalForDb.mrpRoPool = new Pool({
      connectionString: process.env.SOHAMYOGA_RO_DATABASE_URL,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalForDb.mrpRoPool;
}

export function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, values);
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
