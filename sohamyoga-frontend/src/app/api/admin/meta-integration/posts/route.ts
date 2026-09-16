import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id TEXT,
      post_id TEXT UNIQUE,
      post_type TEXT,
      message TEXT,
      full_picture TEXT,
      permalink_url TEXT,
      platform TEXT DEFAULT 'facebook',
      status TEXT DEFAULT 'published',
      likes INT DEFAULT 0,
      comments INT DEFAULT 0,
      shares INT DEFAULT 0,
      reach INT DEFAULT 0,
      impressions INT DEFAULT 0,
      video_views INT DEFAULT 0,
      created_time TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const pool = getPool();
    await ensureSchema();

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const postType = searchParams.get('post_type');

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (platform && platform !== 'all') {
      conditions.push(`platform = $${values.length + 1}`);
      values.push(platform);
    }
    if (postType && postType !== 'all') {
      conditions.push(`post_type = $${values.length + 1}`);
      values.push(postType);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM meta_posts ${where} ORDER BY created_at DESC LIMIT 100`,
      values
    );

    return Response.json({ posts: rows, total: rows.length, demo: !process.env.META_PAGE_ACCESS_TOKEN });
  } catch (err) {
    console.error('[meta-posts GET]', err);
    return Response.json({ error: 'Failed to load posts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const pool = getPool();
    await ensureSchema();

    const body = await req.json() as {
      page_id: string;
      message: string;
      image_url?: string;
      platform: 'facebook' | 'instagram';
      post_type: 'feed' | 'reel' | 'story';
    };

    if (!body.message || !body.platform) {
      return Response.json({ error: 'message and platform are required' }, { status: 400 });
    }

    const token = process.env.META_PAGE_ACCESS_TOKEN;
    const pageId = body.page_id || process.env.META_PAGE_ID;
    let postId = `post_${Date.now()}`;
    let status = 'draft';
    let permalink: string | null = null;
    let warning: string | undefined;
    let metaResult: Record<string, unknown> | null = null;

    if (!token || !pageId) {
      warning = 'Post saved as draft — connect your page to publish. Manage posts at https://business.facebook.com';
    } else {
      try {
        if (body.platform === 'facebook') {
          const fbBody: Record<string, string> = { message: body.message, access_token: token };
          if (body.image_url) fbBody.link = body.image_url;

          const fbRes = await fetch(
            `https://graph.facebook.com/v18.0/${pageId}/feed`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fbBody),
              signal: AbortSignal.timeout(15000),
            }
          );
          if (fbRes.ok) {
            metaResult = await fbRes.json() as Record<string, unknown>;
            postId = String(metaResult.id || postId);
            status = 'published';
            permalink = `https://www.facebook.com/${postId}`;
          } else {
            const errData = await fbRes.json() as Record<string, unknown>;
            warning = `Meta API error: ${JSON.stringify(errData)}`;
          }
        } else if (body.platform === 'instagram') {
          // Step 1: create media container
          const igUserId = process.env.META_IG_USER_ID || pageId;
          const step1Body: Record<string, string> = {
            caption: body.message,
            access_token: token,
          };
          if (body.image_url) step1Body.image_url = body.image_url;
          if (body.post_type === 'reel') {
            step1Body.media_type = 'REELS';
            if (body.image_url) step1Body.video_url = body.image_url;
          }

          const step1Res = await fetch(
            `https://graph.facebook.com/v18.0/${igUserId}/media`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(step1Body),
              signal: AbortSignal.timeout(15000),
            }
          );

          if (step1Res.ok) {
            const step1Data = await step1Res.json() as Record<string, unknown>;
            const containerId = String(step1Data.id);

            // Step 2: publish
            const step2Res = await fetch(
              `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creation_id: containerId, access_token: token }),
                signal: AbortSignal.timeout(15000),
              }
            );

            if (step2Res.ok) {
              metaResult = await step2Res.json() as Record<string, unknown>;
              postId = String(metaResult.id || postId);
              status = 'published';
            } else {
              warning = 'Instagram media publish step failed — saved as draft.';
            }
          } else {
            warning = 'Instagram media container creation failed — saved as draft.';
          }
        }
      } catch (fetchErr) {
        console.error('[meta-posts publish]', fetchErr);
        warning = 'Publishing request failed — saved as draft.';
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO meta_posts (page_id, post_id, post_type, message, full_picture, permalink_url, platform, status, created_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()::TEXT)
       ON CONFLICT (post_id) DO UPDATE SET status = EXCLUDED.status, permalink_url = EXCLUDED.permalink_url
       RETURNING *`,
      [pageId, postId, body.post_type, body.message, body.image_url || null, permalink, body.platform, status]
    );

    return Response.json(
      { post: rows[0], metaResult, warning, manual_url: warning ? 'https://business.facebook.com' : undefined },
      { status: 201 }
    );
  } catch (err) {
    console.error('[meta-posts POST]', err);
    return Response.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
