import { query } from '@/lib/postgres';

export interface ClassTypeTrend {
  className: string;
  currentMonthBookings: number;
  previousMonthBookings: number;
  changePercent: number | null;
  trend: 'trending_up' | 'trending_down' | 'stable' | 'insufficient_data';
}

/** Real "Market Trend Intelligence" -- month-over-month real booking demand
 * per class type (class_session.class_name via booking.booked_at), the
 * actual internal market-demand signal this studio has, rather than a
 * fabricated external search-trend feed with no real data source behind
 * it. Explicitly reports insufficient_data instead of a misleading 0%
 * change when there's no real prior-month baseline to compare against. */
export async function computeMarketTrends(tenantId: string): Promise<ClassTypeTrend[]> {
  // is_current computed in SQL (not reconstructed from a returned Date in JS)
  // to avoid a timezone mismatch between the DB's month boundary and a
  // JS Date built from the Node process's local timezone.
  const result = await query<{ class_name: string; is_current: boolean; bookings: string }>(
    `SELECT cs.class_name,
            (date_trunc('month', b.booked_at) = date_trunc('month', now())) AS is_current,
            count(*)::text AS bookings
     FROM booking b JOIN class_session cs ON cs.id = b.class_session_id
     WHERE cs.tenant_id = $1 AND b.status <> 'cancelled'
       AND b.booked_at >= date_trunc('month', now()) - interval '1 month'
     GROUP BY cs.class_name, is_current`,
    [tenantId]
  );

  const byClass = new Map<string, { current: number; previous: number }>();

  for (const row of result.rows) {
    const entry = byClass.get(row.class_name) ?? { current: 0, previous: 0 };
    if (row.is_current) entry.current = Number(row.bookings);
    else entry.previous = Number(row.bookings);
    byClass.set(row.class_name, entry);
  }

  const trends: ClassTypeTrend[] = [];
  for (const [className, { current, previous }] of byClass) {
    if (previous === 0) {
      trends.push({ className, currentMonthBookings: current, previousMonthBookings: previous, changePercent: null, trend: 'insufficient_data' });
      continue;
    }
    const changePercent = Math.round(((current - previous) / previous) * 100);
    const trend: ClassTypeTrend['trend'] = changePercent > 15 ? 'trending_up' : changePercent < -15 ? 'trending_down' : 'stable';
    trends.push({ className, currentMonthBookings: current, previousMonthBookings: previous, changePercent, trend });
  }

  return trends.sort((a, b) => (b.changePercent ?? -Infinity) - (a.changePercent ?? -Infinity));
}
