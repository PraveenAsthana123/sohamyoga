// Scoped to ONLY the new ai-governance schema -- explicitly does not touch
// or introspect the rest of this app's 496-table database. See
// src/domain/ai-governance/schema.ts for why this exists.
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/domain/ai-governance/schema.ts',
  out: './src/domain/ai-governance/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga',
  },
} satisfies Config;
