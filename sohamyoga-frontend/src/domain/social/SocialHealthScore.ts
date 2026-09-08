import { query } from '@/lib/postgres';
import { combineWeightedScore, trafficLightFor, TrafficLight } from '@/domain/shared/HealthModel';

export interface SocialHealthReport {
  overallScore: number;
  trafficLight: TrafficLight;
  sentimentHealth: { positiveCount: number; negativeCount: number; score: number };
  crisisHealth: { recentCrisisDays: number; score: number };
  viralActivity: { viralPostCount30d: number; score: number };
}

/** Real "Social Health Score" -- a third consumer of the shared HealthModel
 * (see BrandHealthScore.ts, ResearchHealthScore.ts), rolling up 3
 * already-real social signals: sentiment_log positive/negative ratio,
 * crisis_signal recent history, and viral_signal activity. Each component
 * null-safely defaults to 100 with no data, same convention used
 * throughout this session. */
export async function computeSocialHealthScore(tenantId: string): Promise<SocialHealthReport> {
  const sentiment = await query<{ sentiment: string; n: string }>(
    `SELECT sentiment, count(*)::text AS n FROM sentiment_log
     WHERE created_at >= now() - interval '30 days' AND sentiment IN ('positive','negative')
     GROUP BY sentiment`
  );
  const positiveCount = Number(sentiment.rows.find((r) => r.sentiment === 'positive')?.n ?? 0);
  const negativeCount = Number(sentiment.rows.find((r) => r.sentiment === 'negative')?.n ?? 0);
  const sentimentTotal = positiveCount + negativeCount;
  const sentimentScore = sentimentTotal === 0 ? 100 : Math.round((positiveCount / sentimentTotal) * 100);

  const crisis = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM crisis_signal WHERE is_crisis = true AND window_date >= CURRENT_DATE - interval '30 days'`
  );
  const recentCrisisDays = Number(crisis.rows[0].n);
  const crisisScore = Math.max(0, 100 - recentCrisisDays * 25);

  const viral = await query<{ n: string }>(
    `SELECT count(DISTINCT vs.post_id)::text AS n FROM viral_signal vs
     WHERE vs.tenant_id = $1 AND vs.is_viral = true AND vs.computed_at >= now() - interval '30 days'`,
    [tenantId]
  );
  const viralPostCount30d = Number(viral.rows[0].n);
  const viralScore = Math.min(100, 70 + viralPostCount30d * 10);

  const overallScore = combineWeightedScore([
    { score: sentimentScore, weight: 2 },
    { score: crisisScore, weight: 2 },
    { score: viralScore, weight: 1 },
  ]);

  return {
    overallScore,
    trafficLight: trafficLightFor(overallScore),
    sentimentHealth: { positiveCount, negativeCount, score: sentimentScore },
    crisisHealth: { recentCrisisDays, score: crisisScore },
    viralActivity: { viralPostCount30d, score: viralScore },
  };
}
