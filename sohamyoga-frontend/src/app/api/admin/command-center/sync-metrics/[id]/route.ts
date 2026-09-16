import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const itemRes = await query(`SELECT * FROM unified_content_item WHERE id = $1`, [id]);
    if (!itemRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const item = itemRes.rows[0] as {
      source_id: string; item_type: string;
    };

    let updated = false;

    if (item.item_type === 'social_post') {
      // Pull latest from social_post_analytics
      const analytics = await query(
        `SELECT impressions, reach, clicks, likes, comments, shares, saves, conversions
         FROM social_post_analytics
         WHERE post_id = $1
         ORDER BY fetched_at DESC LIMIT 1`,
        [item.source_id]
      );
      if (analytics.rows.length > 0) {
        const a = analytics.rows[0] as {
          impressions: number; reach: number; clicks: number; likes: number;
          comments: number; shares: number; saves: number; conversions: number;
        };
        const reach = a.reach > 0 ? a.reach : a.impressions;
        const engRate = reach > 0
          ? (((a.likes || 0) + (a.comments || 0) + (a.shares || 0)) / reach * 100)
          : 0;
        await query(
          `UPDATE unified_content_item
           SET impressions=$1, reach=$2, clicks=$3, likes=$4, comments=$5,
               shares=$6, saves=$7, conversions=$8, engagement_rate=$9,
               last_synced_at=NOW(), updated_at=NOW()
           WHERE id=$10`,
          [a.impressions, a.reach, a.clicks, a.likes, a.comments,
           a.shares, a.saves, a.conversions, engRate.toFixed(3), id]
        );
        updated = true;
      }
    } else if (item.item_type === 'ad') {
      // Pull from ad_engagement
      const adStats = await query(
        `SELECT
           COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
           COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
           COUNT(*) FILTER (WHERE event_type = 'conversion') as conversions
         FROM ad_engagement WHERE plan_id = $1`,
        [item.source_id]
      );
      if (adStats.rows.length > 0) {
        const a = adStats.rows[0] as { impressions: string; clicks: string; conversions: string };
        const imp = parseInt(a.impressions ?? '0', 10);
        const clk = parseInt(a.clicks ?? '0', 10);
        const ctr = imp > 0 ? (clk / imp * 100) : 0;
        await query(
          `UPDATE unified_content_item
           SET impressions=$1, clicks=$2, conversions=$3, ctr=$4,
               last_synced_at=NOW(), updated_at=NOW()
           WHERE id=$5`,
          [imp, clk, parseInt(a.conversions ?? '0', 10), ctr.toFixed(3), id]
        );
        updated = true;
      }
    }

    const finalItem = await query(`SELECT * FROM unified_content_item WHERE id = $1`, [id]);
    return Response.json({ item: finalItem.rows[0], updated });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
