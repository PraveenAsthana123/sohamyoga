import { query } from '@/lib/postgres';
import { combineWeightedScore, trafficLightFor, TrafficLight } from '@/domain/shared/HealthModel';

export interface CommunicationHealthReport {
  overallScore: number;
  trafficLight: TrafficLight;
  deliveryHealth: { sent: number; failed: number; score: number };
  suppressionHealth: { suppressedLast30d: number; score: number };
  optOutHealth: { optedOutLast30d: number; score: number };
}

/** Real "Communication Health Score" -- a fifth consumer of the shared
 * HealthModel, rolling up 3 already-real signals: notification_history
 * sent/failed delivery ratio (30d), suppression_list additions (30d,
 * bounces/complaints), and customer opt-outs (30d). Null-safely defaults
 * to 100 with no data, same convention used throughout this session. */
export async function computeCommunicationHealthScore(tenantId: string): Promise<CommunicationHealthReport> {
  const delivery = await query<{ status: string; n: string }>(
    `SELECT status, count(*)::text AS n FROM notification_history
     WHERE tenant_id = $1 AND sent_at >= now() - interval '30 days' GROUP BY status`,
    [tenantId]
  );
  const sent = Number(delivery.rows.find((r) => r.status === 'sent')?.n ?? 0);
  const failed = Number(delivery.rows.find((r) => r.status === 'failed')?.n ?? 0);
  const deliveryTotal = sent + failed;
  const deliveryScore = deliveryTotal === 0 ? 100 : Math.round((sent / deliveryTotal) * 100);

  const suppression = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM suppression_list WHERE tenant_id = $1 AND created_at >= now() - interval '30 days'`,
    [tenantId]
  );
  const suppressedLast30d = Number(suppression.rows[0].n);
  const suppressionScore = Math.max(0, 100 - suppressedLast30d * 10);

  const optOuts = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM customer
     WHERE tenant_id = $1 AND email_opt_in = false AND updated_at >= now() - interval '30 days'`,
    [tenantId]
  );
  const optedOutLast30d = Number(optOuts.rows[0].n);
  const optOutScore = Math.max(0, 100 - optedOutLast30d * 5);

  const overallScore = combineWeightedScore([
    { score: deliveryScore, weight: 2 },
    { score: suppressionScore, weight: 1 },
    { score: optOutScore, weight: 1 },
  ]);

  return {
    overallScore,
    trafficLight: trafficLightFor(overallScore),
    deliveryHealth: { sent, failed, score: deliveryScore },
    suppressionHealth: { suppressedLast30d, score: suppressionScore },
    optOutHealth: { optedOutLast30d, score: optOutScore },
  };
}
