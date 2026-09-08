// Drizzle client, scoped to this module only. The rest of the app uses
// src/lib/postgres.ts's raw pg pool (see ADR-0001) -- this is a deliberately
// separate, isolated client for the new ai-governance tables specifically,
// not a replacement for the app-wide pattern.
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __aiGovernancePool: Pool | undefined;
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }
  if (!global.__aiGovernancePool) {
    global.__aiGovernancePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return global.__aiGovernancePool;
}

export function getAiGovernanceDb() {
  return drizzle(getPool(), { schema });
}
