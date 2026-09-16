// PatreonPostSyncJob — daily 11am
// Fetches post stats from Patreon API (likes, comments, patron_count) and upserts
// metrics to unified_content_item.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface PatreonPost {
  id: string;
  attributes: {
    title?: string;
    url?: string;
    like_count?: number;
    comment_count?: number;
    patron_count?: number;
    published_at?: string;
  };
}

async function fetchCampaignPosts(
  accessToken: string,
  campaignId: string,
  pageSize = 20,
): Promise<PatreonPost[]> {
  const fields = encodeURIComponent('title,url,like_count,comment_count,patron_count,published_at');
  const res = await fetch(
    `https://www.patreon.com/api/oauth2/v2/campaigns/${campaignId}/posts?page[count]=${pageSize}&fields[post]=${fields}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Patreon API error ${res.status}: ${await res.text().catch(() => '')}`);
  }

  const body = (await res.json().catch(() => ({}))) as { data?: PatreonPost[] };
  return body.data ?? [];
}

export async function run(): Promise<void> {
  const accessToken  = process.env['PATREON_ACCESS_TOKEN'];
  const campaignId   = process.env['PATREON_CAMPAIGN_ID'];

  if (!accessToken || !campaignId) return; // Honest no-op

  let synced = 0;

  let posts: PatreonPost[];
  try {
    posts = await fetchCampaignPosts(accessToken, campaignId);
  } catch (err) {
    console.error('[patreon-post-sync] fetch failed:', err instanceof Error ? err.message : err);
    return;
  }

  for (const post of posts) {
    const attr = post.attributes;
    const idempotencyKey = `patreon-post-${post.id}`;

    await db.query(
      `INSERT INTO unified_content_item
         (item_type, source_id, platform, content_type, caption, status, external_url,
          likes, comments, created_at, updated_at)
       VALUES ('social_post', $1, 'patreon', 'creator_post', $2, 'published', $3, $4, $5, $6, now())
       ON CONFLICT (source_id, platform) DO UPDATE SET
         likes = EXCLUDED.likes,
         comments = EXCLUDED.comments,
         updated_at = now()`,
      [
        idempotencyKey,
        attr.title ?? 'Untitled',
        attr.url ?? null,
        attr.like_count ?? 0,
        attr.comment_count ?? 0,
        attr.published_at ? new Date(attr.published_at) : new Date(),
      ],
    );

    // Also update patron_count on social_platform_analytics as a campaign-level metric
    if (typeof attr.patron_count === 'number') {
      await db.query(
        `INSERT INTO social_platform_analytics
           (platform, account_id, metric_date, patron_count, synced_at)
         VALUES ('patreon', $1, CURRENT_DATE, $2, now())
         ON CONFLICT (platform, account_id, metric_date) DO UPDATE SET
           patron_count = GREATEST(social_platform_analytics.patron_count, EXCLUDED.patron_count),
           synced_at = now()`,
        [campaignId, attr.patron_count],
      );
    }

    synced++;
  }

  if (synced > 0) {
    console.log(`[patreon-post-sync] synced=${synced} posts`);
  }
}
