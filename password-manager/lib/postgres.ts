import { Pool, type QueryResult, type QueryResultRow } from 'pg';

const g = globalThis as unknown as { pmPool?: Pool };

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  if (!g.pmPool) {
    g.pmPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  return g.pmPool;
}

export function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, values);
}
