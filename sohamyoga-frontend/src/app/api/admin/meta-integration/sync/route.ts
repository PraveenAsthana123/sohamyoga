import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const pool = getPool();
    const token = process.env.META_PAGE_ACCESS_TOKEN;
    const pageId = process.env.META_PAGE_ID;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;
    const base = 'https://graph.facebook.com/v18.0';

    const synced = { posts: 0, reviews: 0, campaigns: 0 };
    const warnings: string[] = [];

    if (!token || !pageId) {
      return Response.json({
        synced,
        warnings: ['META_PAGE_ACCESS_TOKEN and META_PAGE_ID are required for live sync. Data remains from seed.'],
        demo: true,
      });
    }

    // Sync posts
    try {
      const postsRes = await fetch(
        `${base}/${pageId}/posts?fields=id,message,full_picture,permalink_url,created_time,likes.summary(true),comments.summary(true),shares&access_token=${token}&limit=25`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (postsRes.ok) {
        const postsData = await postsRes.json() as { data: Record<string, unknown>[] };
        for (const p of (postsData.data || [])) {
          const likes = (p.likes as { summary: { total_count: number } })?.summary?.total_count || 0;
          const comments = (p.comments as { summary: { total_count: number } })?.summary?.total_count || 0;
          const shares = (p.shares as { count: number })?.count || 0;
          await pool.query(
            `INSERT INTO meta_posts (page_id, post_id, message, full_picture, permalink_url, platform, status, likes, comments, shares, created_time)
             VALUES ($1, $2, $3, $4, $5, 'facebook', 'published', $6, $7, $8, $9)
             ON CONFLICT (post_id) DO UPDATE SET likes = EXCLUDED.likes, comments = EXCLUDED.comments, shares = EXCLUDED.shares`,
            [pageId, p.id, p.message || '', p.full_picture || null, p.permalink_url || null, likes, comments, shares, p.created_time]
          );
          synced.posts++;
        }
      } else {
        warnings.push('Posts sync failed — Meta API returned error');
      }
    } catch (e) {
      warnings.push(`Posts sync error: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    // Sync reviews/ratings
    try {
      const reviewsRes = await fetch(
        `${base}/${pageId}/ratings?fields=reviewer,rating,review_text,created_time&access_token=${token}&limit=50`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json() as { data: Record<string, unknown>[] };
        for (const r of (reviewsData.data || [])) {
          const reviewer = r.reviewer as { name?: string; id?: string } | undefined;
          const sentiment = Number(r.rating) >= 4 ? 'positive' : Number(r.rating) <= 2 ? 'negative' : 'neutral';
          await pool.query(
            `INSERT INTO meta_reviews (review_id, page_id, reviewer_name, reviewer_id, rating, review_text, created_time, platform, sentiment)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'facebook', $8)
             ON CONFLICT (review_id) DO UPDATE SET rating = EXCLUDED.rating, review_text = EXCLUDED.review_text`,
            [
              `${pageId}_${r.created_time}`,
              pageId,
              reviewer?.name || 'Anonymous',
              reviewer?.id || null,
              r.rating,
              r.review_text || null,
              r.created_time,
              sentiment,
            ]
          );
          synced.reviews++;
        }
      } else {
        warnings.push('Reviews sync failed — check page permissions (pages_read_user_content)');
      }
    } catch (e) {
      warnings.push(`Reviews sync error: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    // Sync ad campaigns
    if (adAccountId) {
      try {
        const adsRes = await fetch(
          `${base}/act_${adAccountId}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget&access_token=${token}&limit=25`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (adsRes.ok) {
          const adsData = await adsRes.json() as { data: Record<string, unknown>[] };
          for (const c of (adsData.data || [])) {
            await pool.query(
              `INSERT INTO meta_ad_campaigns (campaign_id, campaign_name, objective, status, daily_budget, lifetime_budget)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (campaign_id) DO UPDATE SET status = EXCLUDED.status, campaign_name = EXCLUDED.campaign_name`,
              [
                c.id,
                c.name,
                c.objective,
                c.status,
                c.daily_budget ? Number(c.daily_budget) / 100 : null,
                c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
              ]
            );
            synced.campaigns++;
          }
        } else {
          warnings.push('Ad campaigns sync failed — check ads_management permission');
        }
      } catch (e) {
        warnings.push(`Campaigns sync error: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    } else {
      warnings.push('META_AD_ACCOUNT_ID not set — skipping ad campaigns sync');
    }

    return Response.json({ synced, warnings, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[meta-sync POST]', err);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}
