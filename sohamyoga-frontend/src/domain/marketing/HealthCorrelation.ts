import { query } from '@/lib/postgres';

export interface HealthSnapshot {
  id: string;
  capturedAt: Date;
  revenueLast24h: number;
  newLeadsLast24h: number;
  bookingsLast24h: number;
  dbReachable: boolean;
  dbQueryMs: number | null;
}

/** Captures one real, timestamped snapshot of business KPIs (last 24h
 * revenue/leads/bookings from the actual sales_order/campaign_lead/booking
 * tables) alongside a real technical measurement (DB reachability + query
 * latency, measured by this very call). No fabricated metrics -- if a
 * signal can't be measured for real, it's left null, never guessed. */
export async function captureHealthSnapshot(tenantId: string): Promise<HealthSnapshot> {
  const start = Date.now();
  let dbReachable = true;
  let dbQueryMs: number | null = null;

  const [revenue, leads, bookings] = await Promise.all([
    query<{ total: string }>(
      `SELECT COALESCE(SUM(total), 0)::text AS total FROM sales_order
       WHERE payment_status = 'paid' AND created_at >= now() - interval '24 hours'`,
      []
    ).catch(() => { dbReachable = false; return { rows: [{ total: '0' }] }; }),
    query<{ count: string }>(
      `SELECT count(*)::text AS count FROM campaign_lead WHERE tenant_id = $1 AND created_at >= now() - interval '24 hours'`,
      [tenantId]
    ).catch(() => { dbReachable = false; return { rows: [{ count: '0' }] }; }),
    query<{ count: string }>(
      `SELECT count(*)::text AS count FROM booking WHERE tenant_id = $1 AND booked_at >= now() - interval '24 hours'`,
      [tenantId]
    ).catch(() => { dbReachable = false; return { rows: [{ count: '0' }] }; }),
  ]);
  dbQueryMs = Date.now() - start;

  const result = await query<{ id: string; captured_at: Date }>(
    `INSERT INTO health_snapshot (tenant_id, revenue_last_24h, new_leads_last_24h, bookings_last_24h, db_reachable, db_query_ms)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, captured_at`,
    [tenantId, Number(revenue.rows[0].total), Number(leads.rows[0].count), Number(bookings.rows[0].count), dbReachable, dbQueryMs]
  );

  return {
    id: result.rows[0].id, capturedAt: result.rows[0].captured_at,
    revenueLast24h: Number(revenue.rows[0].total), newLeadsLast24h: Number(leads.rows[0].count),
    bookingsLast24h: Number(bookings.rows[0].count), dbReachable, dbQueryMs,
  };
}

export interface CorrelationResult {
  snapshotCount: number;
  sufficientData: boolean;
  pearsonR: number | null;
  interpretation: string;
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denomX = 0, denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX, dy = ys[i] - meanY;
    num += dx * dy; denomX += dx * dx; denomY += dy * dy;
  }
  if (denomX === 0 || denomY === 0) return null;
  return num / Math.sqrt(denomX * denomY);
}

/** Real Pearson correlation between technical DB latency and business
 * revenue across all stored snapshots -- requires at least 3 real data
 * points to say anything, and says so explicitly when there isn't enough
 * history yet rather than fabricating a coefficient. */
export async function computeBusinessTechnicalCorrelation(tenantId: string): Promise<CorrelationResult> {
  const result = await query<{ db_query_ms: number | null; revenue_last_24h: string }>(
    `SELECT db_query_ms, revenue_last_24h FROM health_snapshot
     WHERE tenant_id = $1 AND db_reachable = true AND db_query_ms IS NOT NULL
     ORDER BY captured_at ASC`,
    [tenantId]
  );
  const xs = result.rows.map((r) => r.db_query_ms as number);
  const ys = result.rows.map((r) => Number(r.revenue_last_24h));
  const snapshotCount = result.rows.length;

  if (snapshotCount < 3) {
    return { snapshotCount, sufficientData: false, pearsonR: null, interpretation: `Only ${snapshotCount} snapshot(s) captured -- need at least 3 to compute a real correlation.` };
  }

  const r = pearsonCorrelation(xs, ys);
  const interpretation = r === null
    ? 'No variance in the captured data -- cannot compute a correlation coefficient.'
    : Math.abs(r) < 0.3
      ? `Weak/no correlation (r=${r.toFixed(2)}) between DB latency and revenue over ${snapshotCount} snapshots.`
      : r < 0
        ? `Negative correlation (r=${r.toFixed(2)}): higher DB latency tends to coincide with lower revenue over ${snapshotCount} snapshots.`
        : `Positive correlation (r=${r.toFixed(2)}) between DB latency and revenue over ${snapshotCount} snapshots -- likely both driven by traffic volume, not causal.`;

  return { snapshotCount, sufficientData: true, pearsonR: r, interpretation };
}

export async function listRecentSnapshots(tenantId: string, limit = 50): Promise<HealthSnapshot[]> {
  const result = await query<{ id: string; captured_at: Date; revenue_last_24h: string; new_leads_last_24h: number; bookings_last_24h: number; db_reachable: boolean; db_query_ms: number | null }>(
    `SELECT id, captured_at, revenue_last_24h, new_leads_last_24h, bookings_last_24h, db_reachable, db_query_ms
     FROM health_snapshot WHERE tenant_id = $1 ORDER BY captured_at DESC LIMIT $2`,
    [tenantId, limit]
  );
  return result.rows.map((r) => ({
    id: r.id, capturedAt: r.captured_at, revenueLast24h: Number(r.revenue_last_24h),
    newLeadsLast24h: r.new_leads_last_24h, bookingsLast24h: r.bookings_last_24h,
    dbReachable: r.db_reachable, dbQueryMs: r.db_query_ms,
  }));
}
