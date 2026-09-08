import { query as poolQuery } from '@/lib/postgres';

// Accepts either the shared pool's query() or a transaction's PoolClient.query()
// so dedup can run inside an existing transaction (event registration,
// form submissions) without a second, separate connection racing the
// in-flight one. Typed as this minimal shape (not PoolClient's full
// overload set) so both satisfy it structurally without ambiguous overload
// resolution at the call site.
interface Executor { query(sql: string, values?: unknown[]): Promise<{ rows: { id: string }[] }> }

const defaultExecutor: Executor = { query: (sql, values) => poolQuery<{ id: string }>(sql, values) };

// Real lead dedup -- confirmed zero implementation across all 4 real
// campaign_lead write paths before this (grep, 2026-09-01). Matches on
// email (case-insensitive) within the tenant; phone match is a secondary
// signal since phone numbers are shared within households more often than
// emails are shared between distinct people.
export async function findDuplicateLead(tenantId: string, email: string, exec: Executor = defaultExecutor): Promise<string | null> {
  const result = await exec.query(
    `SELECT id FROM campaign_lead WHERE tenant_id = $1 AND lower(email) = lower($2) AND duplicate_of_lead_id IS NULL ORDER BY created_at ASC LIMIT 1`,
    [tenantId, email],
  );
  return result.rows[0]?.id ?? null;
}

// Marks a newly-inserted lead as a duplicate of an earlier one, and bumps
// the original's updated_at so it resurfaces as recently active -- a
// genuine repeat inquiry is a real signal, not noise to discard silently.
export async function markAsDuplicate(newLeadId: string, originalLeadId: string, exec: Executor = defaultExecutor): Promise<void> {
  await exec.query(`UPDATE campaign_lead SET duplicate_of_lead_id = $2 WHERE id = $1`, [newLeadId, originalLeadId]);
  await exec.query(`UPDATE campaign_lead SET updated_at = now() WHERE id = $1`, [originalLeadId]);
}
