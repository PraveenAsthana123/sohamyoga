import { query } from '@/lib/postgres';

export const PaidAdsSyncJob = {
  name: 'paid-ads-sync',
  schedule: '30 */6 * * *',
  async run(): Promise<{ ok: boolean; synced?: number; error?: string }> {
    try {
      // Sync local ad_analytics with any connected ad platform.
      // For now, compute derived KPIs from stored impression/click data.
      const result = await query(
        `SELECT COUNT(*) as campaigns,
                COALESCE(SUM(impressions), 0) as total_impressions,
                COALESCE(SUM(clicks), 0) as total_clicks
         FROM ad_campaign
         WHERE status = 'active'`,
        [],
      );
      const row = result.rows[0];

      await query(
        `INSERT INTO job_run_log (job_name, status, detail, ran_at)
         VALUES ($1, 'ok', $2, NOW())
         ON CONFLICT DO NOTHING`,
        [
          'paid-ads-sync',
          `Active campaigns: ${row.campaigns}, impressions: ${row.total_impressions}, clicks: ${row.total_clicks}`,
        ],
      ).catch(() => {/* table may not exist in all envs */});

      return { ok: true, synced: Number(row.campaigns) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
