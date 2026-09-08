import { query } from '@/lib/postgres';

export type ObjectiveMetric = 'revenue_monthly' | 'new_leads_monthly' | 'bookings_monthly';
const METRICS: ObjectiveMetric[] = ['revenue_monthly', 'new_leads_monthly', 'bookings_monthly'];

export interface ObjectiveStatus {
  metricKey: ObjectiveMetric;
  targetValue: number | null;
  actualValue: number;
  progressPercent: number | null;
  onTrack: boolean | null;
}

async function actualForMetric(metric: ObjectiveMetric): Promise<number> {
  if (metric === 'revenue_monthly') {
    const r = await query<{ total: string }>(
      `SELECT COALESCE(SUM(total),0)::text AS total FROM sales_order WHERE payment_status = 'paid' AND created_at >= date_trunc('month', now())`
    );
    return Number(r.rows[0].total);
  }
  if (metric === 'new_leads_monthly') {
    const r = await query<{ count: string }>(
      `SELECT count(*)::text AS count FROM campaign_lead WHERE created_at >= date_trunc('month', now())`
    );
    return Number(r.rows[0].count);
  }
  const r = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM booking WHERE booked_at >= date_trunc('month', now())`
  );
  return Number(r.rows[0].count);
}

/** Real Control Tower Objectives -- staff-set targets compared against real
 * month-to-date actuals from the same tables the Executive Dashboard and
 * Health Correlation already use. Not a static goals screen: progress is
 * computed live from real data every call. */
export async function getObjectivesStatus(tenantId: string): Promise<ObjectiveStatus[]> {
  const targets = await query<{ metric_key: ObjectiveMetric; target_value: string }>(
    'SELECT metric_key, target_value FROM control_tower_objective WHERE tenant_id = $1',
    [tenantId]
  );
  const targetMap = new Map(targets.rows.map((r) => [r.metric_key, Number(r.target_value)]));

  const results: ObjectiveStatus[] = [];
  for (const metric of METRICS) {
    const actualValue = await actualForMetric(metric);
    const targetValue = targetMap.get(metric) ?? null;
    const progressPercent = targetValue ? Math.round((actualValue / targetValue) * 100) : null;
    const onTrack = targetValue ? actualValue >= targetValue * (new Date().getDate() / 30) : null;
    results.push({ metricKey: metric, targetValue, actualValue, progressPercent, onTrack });
  }
  return results;
}

export async function setObjectiveTarget(tenantId: string, metric: ObjectiveMetric, targetValue: number, updatedBy: string): Promise<void> {
  await query(
    `INSERT INTO control_tower_objective (tenant_id, metric_key, target_value, updated_by)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, metric_key) DO UPDATE SET target_value = $3, updated_by = $4, updated_at = now()`,
    [tenantId, metric, targetValue, updatedBy]
  );
}
