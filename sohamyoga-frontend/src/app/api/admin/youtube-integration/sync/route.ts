import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseDurationSeconds(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (Number(match[1] || 0) * 3600) + (Number(match[2] || 0) * 60) + Number(match[3] || 0);
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const pool = getPool();
    const key = process.env.YOUTUBE_API_KEY;
    const channelId = process.env.YOUTUBE_CHANNEL_ID;

    const synced = { videos: 0, comments: 0, channelStats: 0 };
    const warnings: string[] = [];

    if (!key || !channelId) {
      return Response.json({
        synced,
        warnings: ['YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID are required for live sync. Data remains from seed.'],
        demo: true,
      });
    }

    // Sync channel stats
    try {
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${key}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (chRes.ok) {
        const chData = await chRes.json() as { items?: Record<string, unknown>[] };
        const ch = chData.items?.[0];
        if (ch) {
          const stats = ch.statistics as Record<string, unknown>;
          await pool.query(
            `INSERT INTO youtube_channel_stats (channel_id, subscriber_count, view_count, video_count)
             VALUES ($1, $2, $3, $4)`,
            [channelId, stats.subscriberCount || 0, stats.viewCount || 0, stats.videoCount || 0]
          );
          synced.channelStats++;
        }
      } else {
        warnings.push('Channel stats sync failed');
      }
    } catch (e) {
      warnings.push(`Channel stats error: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    // Sync videos — search first, then get details
    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&maxResults=50&key=${key}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (searchRes.ok) {
        const searchData = await searchRes.json() as { items?: Record<string, unknown>[] };
        const items = searchData.items || [];
        const videoIds = items.map((i: Record<string, unknown>) => (i.id as Record<string, unknown>)?.videoId).filter(Boolean);

        if (videoIds.length > 0) {
          const detailRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${key}`,
            { signal: AbortSignal.timeout(10000) }
          );

          if (detailRes.ok) {
            const detailData = await detailRes.json() as { items?: Record<string, unknown>[] };
            for (const v of (detailData.items || [])) {
              const snippet = v.snippet as Record<string, unknown>;
              const stats = v.statistics as Record<string, unknown>;
              const contentDetails = v.contentDetails as Record<string, unknown>;
              const durationIso = String(contentDetails?.duration || '');
              const durationSec = parseDurationSeconds(durationIso);
              const videoType = durationSec < 60 ? 'short' : 'video';

              await pool.query(
                `INSERT INTO youtube_videos (video_id, title, description, channel_id, channel_title, thumbnail_url, published_at, duration_iso, duration_seconds, view_count, like_count, comment_count, status, video_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 ON CONFLICT (video_id) DO UPDATE SET view_count = EXCLUDED.view_count, like_count = EXCLUDED.like_count, comment_count = EXCLUDED.comment_count, synced_at = NOW()`,
                [
                  v.id,
                  snippet.title || '',
                  snippet.description || '',
                  channelId,
                  snippet.channelTitle || '',
                  ((snippet.thumbnails as Record<string, Record<string, unknown>> | undefined)?.medium?.url as string) || '',
                  snippet.publishedAt || '',
                  durationIso,
                  durationSec,
                  stats?.viewCount || 0,
                  stats?.likeCount || 0,
                  stats?.commentCount || 0,
                  'public',
                  videoType,
                ]
              );
              synced.videos++;
            }
          } else {
            warnings.push('Video details fetch failed');
          }
        }
      } else {
        warnings.push('Video search failed — check YOUTUBE_API_KEY and channelId');
      }
    } catch (e) {
      warnings.push(`Videos sync error: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    // Sync comments for top videos
    try {
      const { rows: topVids } = await pool.query(
        'SELECT video_id FROM youtube_videos ORDER BY view_count DESC LIMIT 5'
      );
      for (const vid of topVids) {
        try {
          const cmtRes = await fetch(
            `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${vid.video_id}&maxResults=100&key=${key}`,
            { signal: AbortSignal.timeout(10000) }
          );
          if (cmtRes.ok) {
            const cmtData = await cmtRes.json() as { items?: Record<string, unknown>[] };
            for (const thread of (cmtData.items || [])) {
              const top = (thread.snippet as Record<string, unknown>)?.topLevelComment as Record<string, unknown>;
              if (!top) continue;
              const topSnippet = top.snippet as Record<string, unknown>;
              const text = String(topSnippet?.textDisplay || '');
              const sentiment = /great|love|amazing|excellent|perfect|wonderful|best|thank/i.test(text)
                ? 'positive'
                : /bad|hate|terrible|worst|awful|dislike|disappointed/i.test(text)
                  ? 'negative'
                  : 'neutral';

              await pool.query(
                `INSERT INTO youtube_comments (comment_id, video_id, author_name, author_channel_id, text, like_count, reply_count, is_top_comment, published_at, sentiment)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)
                 ON CONFLICT (comment_id) DO UPDATE SET like_count = EXCLUDED.like_count`,
                [
                  String(top.id),
                  vid.video_id,
                  String(topSnippet?.authorDisplayName || 'Unknown'),
                  String((topSnippet?.authorChannelId as Record<string, unknown> | undefined)?.value || ''),
                  text,
                  Number(topSnippet?.likeCount || 0),
                  Number((thread.snippet as Record<string, unknown>)?.totalReplyCount || 0),
                  String(topSnippet?.publishedAt || ''),
                  sentiment,
                ]
              );
              synced.comments++;
            }
          }
        } catch { /* skip this video's comments */ }
      }
    } catch (e) {
      warnings.push(`Comments sync error: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    return Response.json({ synced, warnings, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[youtube-sync POST]', err);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}
