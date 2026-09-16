/**
 * CommandCenterSyncJob — runs every 2 hours
 * Syncs live metrics from social_post_analytics and ad_engagement
 * into unified_content_item for all live/published items.
 */
import { query } from '@/lib/postgres';

export async function run(): Promise<void> {
  console.log('[CommandCenterSyncJob] starting metrics sync');

  try {
    // Sync social post metrics from social_post_analytics
    const socialResult = await query(`
      UPDATE unified_content_item uci
      SET
        impressions = COALESCE(spa.impressions, uci.impressions),
        reach = COALESCE(spa.reach, uci.reach),
        clicks = COALESCE(spa.clicks, uci.clicks),
        likes = COALESCE(spa.likes, uci.likes),
        comments = COALESCE(spa.comments, uci.comments),
        shares = COALESCE(spa.shares, uci.shares),
        saves = COALESCE(spa.saves, uci.saves),
        conversions = COALESCE(spa.conversions::int, uci.conversions),
        engagement_rate = CASE
          WHEN COALESCE(spa.reach, uci.reach) > 0
          THEN ROUND(((COALESCE(spa.likes,0)+COALESCE(spa.comments,0)+COALESCE(spa.shares,0))::numeric / COALESCE(spa.reach, uci.reach) * 100), 3)
          ELSE 0 END,
        last_synced_at = NOW(),
        updated_at = NOW()
      FROM (
        SELECT DISTINCT ON (post_id)
          post_id, impressions, reach, clicks, likes, comments, shares, saves, conversions
        FROM social_post_analytics
        ORDER BY post_id, fetched_at DESC
      ) spa
      WHERE uci.source_id = spa.post_id
        AND uci.item_type = 'social_post'
        AND uci.status IN ('live', 'published')
        AND (uci.last_synced_at IS NULL OR uci.last_synced_at < NOW() - INTERVAL '2 hours')
    `);
    console.log(`[CommandCenterSyncJob] synced ${socialResult.rowCount ?? 0} social posts`);

    // Sync ad metrics from ad_engagement
    const liveAds = await query(`
      SELECT id, source_id FROM unified_content_item
      WHERE item_type = 'ad'
        AND status IN ('live', 'published')
        AND (last_synced_at IS NULL OR last_synced_at < NOW() - INTERVAL '2 hours')
    `);

    let adsSynced = 0;
    for (const ad of liveAds.rows as { id: string; source_id: string }[]) {
      try {
        const stats = await query(
          `SELECT
             COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
             COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
             COUNT(*) FILTER (WHERE event_type = 'conversion') as conversions
           FROM ad_engagement WHERE plan_id = $1`,
          [ad.source_id]
        );
        if (stats.rows.length > 0) {
          const s = stats.rows[0] as { impressions: string; clicks: string; conversions: string };
          const imp = parseInt(s.impressions ?? '0', 10);
          const clk = parseInt(s.clicks ?? '0', 10);
          const ctr = imp > 0 ? (clk / imp * 100) : 0;
          await query(
            `UPDATE unified_content_item
             SET impressions=$1, clicks=$2, conversions=$3, ctr=$4,
                 last_synced_at=NOW(), updated_at=NOW()
             WHERE id=$5`,
            [imp, clk, parseInt(s.conversions ?? '0', 10), parseFloat(ctr.toFixed(3)), ad.id]
          );
          adsSynced++;
        }
      } catch (e) {
        console.error(`[CommandCenterSyncJob] failed for ad ${ad.id}:`, e);
      }
    }
    console.log(`[CommandCenterSyncJob] synced ${adsSynced} ads`);
    console.log('[CommandCenterSyncJob] done');
  } catch (err) {
    console.error('[CommandCenterSyncJob] error:', err);
    throw err;
  }
}
