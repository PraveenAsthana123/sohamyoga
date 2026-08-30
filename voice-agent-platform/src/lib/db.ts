import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __voiceAgentPgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and configure it.');
  }
  return new Pool({ connectionString, max: 10 });
}

// Reused across hot-reloads in dev so we don't leak connections.
export const pool: Pool = global.__voiceAgentPgPool ?? createPool();
if (process.env.NODE_ENV !== 'production') {
  global.__voiceAgentPgPool = pool;
}

export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  const result = await pool.query(text, params);
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}
