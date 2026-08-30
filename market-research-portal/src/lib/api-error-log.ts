// Wires the shared, DB-agnostic wrapper (packages/shared-backend) to this
// app's own Postgres query() — deduplicated 2026-08-24 after sohamyoga-
// frontend built the same pattern independently for its own build-status
// route wiring.
import { createApiErrorLogWrapper } from '@sohamyoga/shared-backend';
import type { NextRequest } from 'next/server';
import { query } from './postgres';

export const withApiErrorLog = createApiErrorLogWrapper<NextRequest>(async (entry) => {
  await query(
    `INSERT INTO api_error_log (method, path, status, error_message) VALUES ($1,$2,$3,$4)`,
    [entry.method, entry.path, entry.status, entry.errorMessage],
  );
});
