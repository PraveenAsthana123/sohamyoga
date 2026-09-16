// GoogleBusinessSyncJob — daily 9am
// Fetches local post insights from Google Business Profile API for each configured
// location and upserts impressions, clicks, direction_requests, phone_calls to
// social_platform_analytics.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface LocalPostInsights {
  localPostId?: string;
  views?: { count?: string };
  actions?: Array<{ actionType?: string; count?: string }>;
}

async function fetchLocalPostInsights(
  accountId: string,
  locationId: string,
  accessToken: string,
): Promise<LocalPostInsights[]> {
  // The API returns a list of local posts with their metrics
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Google Business API error ${res.status}: ${await res.text().catch(() => '')}`);
  }

  const body = (await res.json().catch(() => ({}))) as { localPosts?: LocalPostInsights[] };
  return body.localPosts ?? [];
}

export async function run(): Promise<void> {
  const accountId = process.env['GOOGLE_BUSINESS_ACCOUNT_ID'];
  const accessToken = process.env['GOOGLE_BUSINESS_ACCESS_TOKEN'];

  if (!accountId || !accessToken) {
    return; // Honest no-op
  }

  // Find configured Google Business locations (stored as social_account rows)
  const accounts = await db.query<{
    id: string;
    platform_account_id: string;
    credentials: Record<string, string>;
  }>(`
    SELECT id, platform_account_id, credentials
      FROM social_account
     WHERE platform = 'google_business'
       AND status = 'connected'
  `);

  let synced = 0;

  for (const acct of accounts.rows) {
    const locationId = acct.platform_account_id;
    const token = acct.credentials?.['GOOGLE_BUSINESS_ACCESS_TOKEN'] ?? accessToken;
    const accId = acct.credentials?.['GOOGLE_BUSINESS_ACCOUNT_ID'] ?? accountId;

    try {
      const posts = await fetchLocalPostInsights(accId, locationId, token);

      let impressions = 0;
      let clicks = 0;
      let directionRequests = 0;
      let phoneCalls = 0;

      for (const post of posts) {
        impressions += Number(post.views?.count ?? 0);
        for (const action of post.actions ?? []) {
          const count = Number(action.count ?? 0);
          if (action.actionType === 'WEBSITE') clicks += count;
          else if (action.actionType === 'DRIVING_DIRECTIONS') directionRequests += count;
          else if (action.actionType === 'CALL') phoneCalls += count;
        }
      }

      await db.query(
        `INSERT INTO social_platform_analytics
           (platform, account_id, metric_date, impressions, clicks, direction_requests, phone_calls, synced_at)
         VALUES ('google_business', $1, CURRENT_DATE, $2, $3, $4, $5, now())
         ON CONFLICT (platform, account_id, metric_date) DO UPDATE SET
           impressions = EXCLUDED.impressions,
           clicks = EXCLUDED.clicks,
           direction_requests = EXCLUDED.direction_requests,
           phone_calls = EXCLUDED.phone_calls,
           synced_at = now()`,
        [acct.id, impressions, clicks, directionRequests, phoneCalls],
      );
      synced++;
    } catch (err) {
      console.error(`[google-business-sync] location=${locationId} err:`, err instanceof Error ? err.message : err);
    }
  }

  if (synced > 0) {
    console.log(`[google-business-sync] synced=${synced} locations`);
  }
}
