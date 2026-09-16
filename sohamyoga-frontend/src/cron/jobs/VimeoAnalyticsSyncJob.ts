// VimeoAnalyticsSyncJob — daily 10am
// Fetches video stats (plays, likes, comments, downloads) from Vimeo API for all
// published videos and upserts to unified_content_item metrics.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface VimeoVideoStats {
  plays?: number;
  likes?: number;
  comments?: number;
  downloads?: number;
}

interface VimeoVideo {
  uri: string;
  link: string;
  stats?: VimeoVideoStats;
  name?: string;
}

async function fetchMyVideos(accessToken: string, page = 1, perPage = 25): Promise<VimeoVideo[]> {
  const res = await fetch(
    `https://api.vimeo.com/me/videos?page=${page}&per_page=${perPage}&fields=uri,link,stats,name`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Vimeo API error ${res.status}: ${await res.text().catch(() => '')}`);
  }

  const body = (await res.json().catch(() => ({}))) as { data?: VimeoVideo[] };
  return body.data ?? [];
}

export async function run(): Promise<void> {
  const accessToken = process.env['VIMEO_ACCESS_TOKEN'];
  if (!accessToken) return; // Honest no-op

  let synced = 0;
  let page = 1;

  while (true) {
    let videos: VimeoVideo[];
    try {
      videos = await fetchMyVideos(accessToken, page, 25);
    } catch (err) {
      console.error(`[vimeo-analytics-sync] page=${page} err:`, err instanceof Error ? err.message : err);
      break;
    }

    if (videos.length === 0) break;

    for (const video of videos) {
      const stats = video.stats ?? {};
      const idempotencyKey = `vimeo-${video.uri.replace(/\//g, '-')}`;

      await db.query(
        `INSERT INTO unified_content_item
           (item_type, source_id, platform, content_type, caption, status, external_url,
            impressions, likes, comments, downloads, created_at, updated_at)
         VALUES ('social_post', $1, 'vimeo', 'video_upload', $2, 'published', $3, $4, $5, $6, $7, now(), now())
         ON CONFLICT (source_id, platform) DO UPDATE SET
           impressions = EXCLUDED.impressions,
           likes = EXCLUDED.likes,
           comments = EXCLUDED.comments,
           downloads = EXCLUDED.downloads,
           updated_at = now()`,
        [
          idempotencyKey,
          video.name ?? 'Untitled',
          video.link,
          stats.plays ?? 0,
          stats.likes ?? 0,
          stats.comments ?? 0,
          stats.downloads ?? 0,
        ],
      );
      synced++;
    }

    if (videos.length < 25) break;
    page++;
  }

  if (synced > 0) {
    console.log(`[vimeo-analytics-sync] synced=${synced} videos`);
  }
}
