import { query } from '@/lib/postgres';
import { combineWeightedScore, trafficLightFor, TrafficLight } from '@/domain/shared/HealthModel';

export interface FeedbackHealthReport {
  overallScore: number;
  trafficLight: TrafficLight;
  reviewRateHealth: { reviewed: number; dismissed: number; draft: number; score: number };
  sentimentMixHealth: { positiveThemes: number; negativeThemes: number; score: number };
}

/** Real "Feedback Health Score" -- a 6th consumer of the shared
 * HealthModel, rolling up 2 real signals from voice_of_customer_digest:
 * how much staff review-backlog exists (draft digests piling up
 * unreviewed) and the real theme-level sentiment mix across recent
 * digests. Null-safely defaults to 100 with no data. */
export async function computeFeedbackHealthScore(tenantId: string): Promise<FeedbackHealthReport> {
  const statusCounts = await query<{ status: string; n: string }>(
    `SELECT status, count(*)::text AS n FROM voice_of_customer_digest WHERE tenant_id = $1 GROUP BY status`,
    [tenantId]
  );
  const reviewed = Number(statusCounts.rows.find((r) => r.status === 'reviewed')?.n ?? 0);
  const dismissed = Number(statusCounts.rows.find((r) => r.status === 'dismissed')?.n ?? 0);
  const draft = Number(statusCounts.rows.find((r) => r.status === 'draft')?.n ?? 0);
  const total = reviewed + dismissed + draft;
  const reviewRateScore = total === 0 ? 100 : Math.round(((reviewed + dismissed) / total) * 100);

  const themes = await query<{ themes: { sentiment: string }[] }>(
    `SELECT themes FROM voice_of_customer_digest WHERE tenant_id = $1 ORDER BY period_start DESC LIMIT 8`,
    [tenantId]
  );
  let positiveThemes = 0, negativeThemes = 0;
  for (const row of themes.rows) {
    for (const t of row.themes ?? []) {
      if (t.sentiment === 'positive') positiveThemes++;
      else if (t.sentiment === 'negative') negativeThemes++;
    }
  }
  const themeTotal = positiveThemes + negativeThemes;
  const sentimentScore = themeTotal === 0 ? 100 : Math.round((positiveThemes / themeTotal) * 100);

  const overallScore = combineWeightedScore([
    { score: reviewRateScore, weight: 1 },
    { score: sentimentScore, weight: 2 },
  ]);

  return {
    overallScore,
    trafficLight: trafficLightFor(overallScore),
    reviewRateHealth: { reviewed, dismissed, draft, score: reviewRateScore },
    sentimentMixHealth: { positiveThemes, negativeThemes, score: sentimentScore },
  };
}
