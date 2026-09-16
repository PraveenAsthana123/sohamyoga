/**
 * AdPlannerSyncJob — hourly job
 * Syncs engagement counts and updates ad_post_plan status based on scheduled_at.
 * Real platform API integration would go here; for now, it handles status transitions.
 */
import { query } from '@/lib/postgres';

export async function run(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  try {
    // Transition: scheduled → live (when scheduled_at has passed)
    const activated = await query(`
      UPDATE ad_post_plan
      SET status = 'live', updated_at = now()
      WHERE status = 'scheduled'
        AND scheduled_at <= now()
        AND approval_status = 'approved'
      RETURNING id, headline, platform
    `);
    synced += activated.rowCount || 0;

    if (activated.rowCount && activated.rowCount > 0) {
      console.log(`[AdPlannerSyncJob] Activated ${activated.rowCount} plans:`, activated.rows.map(r => r.headline));
    }

    // Transition: live → ended (after 24h from scheduled_at)
    const ended = await query(`
      UPDATE ad_post_plan
      SET status = 'ended', updated_at = now()
      WHERE status = 'live'
        AND scheduled_at <= now() - interval '24 hours'
      RETURNING id
    `);
    synced += ended.rowCount || 0;

    // Aggregate engagement into ad_post_plan metrics (placeholder for real platform sync)
    // In production: call Google Ads API, Meta Marketing API, etc.
    // For now, log the engagement counts per plan
    const engagementSummary = await query(`
      SELECT
        plan_id,
        COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
        COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
        COUNT(*) FILTER (WHERE event_type = 'conversion') as conversions
      FROM ad_engagement
      WHERE created_at >= now() - interval '1 hour'
      GROUP BY plan_id
    `);

    if (engagementSummary.rowCount && engagementSummary.rowCount > 0) {
      console.log(`[AdPlannerSyncJob] Engagement in last hour: ${engagementSummary.rowCount} plans had activity`);
    }

    // Log job run
    await query(`
      INSERT INTO job_run_log (job_name, status, records_processed, message, ran_at)
      VALUES ('AdPlannerSyncJob', 'success', $1, $2, now())
      ON CONFLICT DO NOTHING
    `, [synced, `Activated: ${activated.rowCount || 0}, Ended: ${ended.rowCount || 0}`]).catch(() => {
      // job_run_log table may not exist yet — not critical
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    console.error('[AdPlannerSyncJob] Error:', msg);
  }

  return { synced, errors };
}

export const schedule = '0 * * * *'; // Every hour
export const jobName = 'AdPlannerSyncJob';
