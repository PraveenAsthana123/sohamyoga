// CrisisDetectionJob — Daily
// "Negative Virality" detection: mirrors ViralDetectionJob's real z-score-
// against-own-baseline methodology exactly, applied to sentiment_log
// negative-volume instead of share velocity. A crisis is flagged only when
// today's negative-sentiment count is a real statistical outlier (z-score
// >= 2) against this account's own trailing daily baseline -- never a
// fixed "5 complaints = crisis" magic number, which would be meaningless
// as volume grows. Advisory only: queues one real notification, never
// auto-responds to anyone.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const BASELINE_DAYS = 14;
const BASELINE_MIN_SAMPLE = 3;
const CRISIS_Z_SCORE_THRESHOLD = 2;

export async function run(): Promise<void> {
  const todayCount = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM sentiment_log
     WHERE sentiment = 'negative' AND created_at >= CURRENT_DATE`,
  );
  const negativeCount = Number(todayCount.rows[0].count);

  const baseline = await db.query<{ day: string; count: string }>(
    `SELECT date_trunc('day', created_at)::date::text AS day, count(*)::text AS count
     FROM sentiment_log
     WHERE sentiment = 'negative' AND created_at >= CURRENT_DATE - interval '${BASELINE_DAYS} days' AND created_at < CURRENT_DATE
     GROUP BY date_trunc('day', created_at)`,
  );

  let baselineMean: number | null = null;
  let baselineStddev: number | null = null;
  let zScore: number | null = null;
  const sampleSize = baseline.rows.length;

  let isCrisis = false;
  if (sampleSize >= BASELINE_MIN_SAMPLE) {
    const counts = baseline.rows.map((r) => Number(r.count));
    baselineMean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, c) => sum + (c - baselineMean!) ** 2, 0) / counts.length;
    baselineStddev = Math.sqrt(variance);

    if (baselineStddev > 0) {
      zScore = (negativeCount - baselineMean) / baselineStddev;
      isCrisis = zScore >= CRISIS_Z_SCORE_THRESHOLD;
    } else {
      // Zero-variance baseline (every day identical): a finite z-score
      // can't be computed, but any count above a perfectly flat baseline
      // is still a real anomaly -- do not silently report z=0 and miss it.
      zScore = null;
      isCrisis = negativeCount > baselineMean;
    }
  }

  await db.query(
    `INSERT INTO crisis_signal (window_date, negative_count, baseline_mean, baseline_stddev, baseline_days, z_score, is_crisis, computed_at)
     VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (window_date) DO UPDATE SET
       negative_count = EXCLUDED.negative_count, baseline_mean = EXCLUDED.baseline_mean,
       baseline_stddev = EXCLUDED.baseline_stddev, baseline_days = EXCLUDED.baseline_days,
       z_score = EXCLUDED.z_score, is_crisis = EXCLUDED.is_crisis, computed_at = now()`,
    [negativeCount, baselineMean, baselineStddev, sampleSize, zScore, isCrisis],
  );

  if (isCrisis) {
    const tenant = await db.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
    const admin = tenant.rowCount
      ? await db.query<{ id: string; email: string }>(
          `SELECT id, email FROM app_user WHERE tenant_id=$1 AND role IN ('admin','owner') AND status='active' LIMIT 1`,
          [tenant.rows[0].id],
        )
      : { rows: [] as { id: string; email: string }[] };
    if (tenant.rowCount && admin.rows[0]) {
      await db.query(
        `INSERT INTO notification_queue
           (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
         VALUES ($1,'crisis_alert','in_app','alert',$2,$3,$4,$5)
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
        [
          tenant.rows[0].id, admin.rows[0].id, admin.rows[0].email,
          JSON.stringify({ negativeCount, baselineMean, zScore }),
          `crisis_${new Date().toISOString().slice(0, 10)}`,
        ],
      );
    }
  }

  console.log(`[crisis-detection] negativeCount=${negativeCount} zScore=${zScore?.toFixed(2) ?? 'n/a'} isCrisis=${isCrisis}`);
  // Do NOT db.end() here — see NotificationRetryJob.ts.
}
