// PinterestPinSyncJob — every 4 hours
// Fetches analytics for published Pinterest pins (impressions, saves, clicks,
// outbound_clicks) from the Pinterest API v5 and upserts into social_post_analytics.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface PinAnalytics {
  impression_count?: number;
  save_count?: number;
  pin_click_count?: number;
  outbound_click_count?: number;
}

async function fetchPinAnalytics(
  pinId: string,
  accessToken: string,
): Promise<PinAnalytics | null> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date();

  const params = new URLSearchParams({
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    metric_types: 'IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK',
    app_types: 'ALL',
    split_field: 'NO_SPLIT',
  });

  const res = await fetch(
    `https://api.pinterest.com/v5/pins/${encodeURIComponent(pinId)}/analytics?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!res.ok) {
    if (res.status === 404) return null; // Pin deleted
    throw new Error(`Pinterest API error ${res.status}: ${await res.text().catch(() => '')}`);
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return null;

  // Pinterest returns per-day breakdown under body.all[0].data.summary_metrics
  const all = body.all as { data?: { summary_metrics?: PinAnalytics } } | undefined;
  return all?.data?.summary_metrics ?? null;
}

export async function run(): Promise<void> {
  let synced = 0;
  let skipped = 0;

  // Find published Pinterest pins that have an external_post_id we can query
  const pins = await db.query<{
    id: string;
    account_id: string;
    external_post_id: string;
    credentials: Record<string, string>;
  }>(`
    SELECT sp.id, sp.account_id, sp.external_post_id, sa.credentials
      FROM social_post sp
      JOIN social_account sa ON sa.id = sp.account_id AND sa.platform = 'pinterest' AND sa.status = 'connected'
     WHERE sp.platform = 'pinterest'
       AND sp.status = 'published'
       AND sp.external_post_id IS NOT NULL
     ORDER BY sp.published_at DESC
     LIMIT 100
  `);

  for (const pin of pins.rows) {
    const accessToken = pin.credentials?.['PINTEREST_ACCESS_TOKEN'] ?? '';
    if (!accessToken) {
      skipped++;
      continue;
    }

    try {
      const metrics = await fetchPinAnalytics(pin.external_post_id, accessToken);
      if (!metrics) {
        skipped++;
        continue;
      }

      await db.query(
        `INSERT INTO social_post_analytics
           (post_id, platform, impressions, saves, clicks, outbound_clicks, synced_at)
         VALUES ($1, 'pinterest', $2, $3, $4, $5, now())
         ON CONFLICT (post_id, platform) DO UPDATE SET
           impressions = EXCLUDED.impressions,
           saves = EXCLUDED.saves,
           clicks = EXCLUDED.clicks,
           outbound_clicks = EXCLUDED.outbound_clicks,
           synced_at = now()`,
        [
          pin.id,
          metrics.impression_count ?? 0,
          metrics.save_count ?? 0,
          metrics.pin_click_count ?? 0,
          metrics.outbound_click_count ?? 0,
        ],
      );
      synced++;
    } catch (err) {
      console.error(`[pinterest-pin-sync] pin=${pin.id} err:`, err instanceof Error ? err.message : err);
      skipped++;
    }
  }

  if (synced + skipped > 0) {
    console.log(`[pinterest-pin-sync] synced=${synced} skipped=${skipped}`);
  }
}
