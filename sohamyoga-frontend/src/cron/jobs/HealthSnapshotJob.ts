// HealthSnapshotJob — Every hour
// Captures one real health_snapshot row per tenant (business KPIs +
// DB reachability/latency) so Business -> Technical Correlation has real
// history to compute against instead of a single live read.

import { query } from '@/lib/postgres';
import { captureHealthSnapshot } from '@/domain/marketing/HealthCorrelation';

export async function run(): Promise<void> {
  const tenants = await query<{ id: string }>('SELECT id FROM tenant');
  let ok = 0, failed = 0;
  for (const t of tenants.rows) {
    try {
      await captureHealthSnapshot(t.id);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(`[health-snapshot] failed for tenant ${t.id}:`, err);
    }
  }
  console.log(`[health-snapshot] ${ok} snapshot(s) captured, ${failed} failed`);
}
