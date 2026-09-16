import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PlatformResult {
  ok: boolean;
  post_id?: string;
  video_id?: string;
  reason?: string;
  manual_url?: string;
}

const PLATFORM_URLS: Record<string, string> = {
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/',
  youtube_shorts: 'https://studio.youtube.com/',
  facebook: 'https://www.facebook.com/',
  linkedin: 'https://www.linkedin.com/',
};

async function attemptPlatformPost(platform: string, _videoUrl: string | null): Promise<PlatformResult> {
  // Check credentials for each platform
  if (platform === 'instagram' || platform === 'facebook') {
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_PAGE_TOKEN) {
      return { ok: false, reason: 'not_configured', manual_url: PLATFORM_URLS[platform] };
    }
    // Real implementation: POST to Meta Graph API
    // For now: credentials present but actual upload requires video file
    return { ok: false, reason: 'video_upload_required', manual_url: PLATFORM_URLS[platform] };
  }

  if (platform === 'youtube_shorts') {
    if (!process.env.YOUTUBE_API_KEY) {
      return { ok: false, reason: 'not_configured', manual_url: PLATFORM_URLS[platform] };
    }
    return { ok: false, reason: 'video_upload_required', manual_url: PLATFORM_URLS[platform] };
  }

  if (platform === 'tiktok') {
    if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
      return { ok: false, reason: 'not_configured', manual_url: PLATFORM_URLS[platform] };
    }
    return { ok: false, reason: 'video_upload_required', manual_url: PLATFORM_URLS[platform] };
  }

  if (platform === 'linkedin') {
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      return { ok: false, reason: 'not_configured', manual_url: PLATFORM_URLS[platform] };
    }
    return { ok: false, reason: 'video_upload_required', manual_url: PLATFORM_URLS[platform] };
  }

  return { ok: false, reason: 'unsupported_platform', manual_url: '' };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();

    const { rows } = await pool.query(`SELECT * FROM video_posting_queue WHERE id=$1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Queue item not found' }, { status: 404 });

    const item = rows[0] as {
      id: string;
      platforms: string[];
      title: string;
      caption: string;
      reel_id: string | null;
      video_project_id: string | null;
      retry_count: number;
    };

    // Get video URL if linked to a reel or project
    let videoUrl: string | null = null;
    if (item.reel_id) {
      const { rows: rl } = await pool.query(`SELECT video_url FROM reels WHERE id=$1`, [item.reel_id]);
      if (rl.length) videoUrl = rl[0].video_url;
    } else if (item.video_project_id) {
      const { rows: vp } = await pool.query(`SELECT output_video_url, source_video_url FROM video_projects WHERE id=$1`, [item.video_project_id]);
      if (vp.length) videoUrl = vp[0].output_video_url || vp[0].source_video_url;
    }

    // Mark as posting
    await pool.query(`UPDATE video_posting_queue SET status='posting' WHERE id=$1`, [params.id]);

    const results: Record<string, PlatformResult> = {};
    let allOk = true;

    for (const platform of item.platforms) {
      const result = await attemptPlatformPost(platform, videoUrl);
      results[platform] = result;
      if (!result.ok) allOk = false;
    }

    const finalStatus = allOk ? 'posted' : (Object.values(results).some(r => r.ok) ? 'posted' : 'failed');
    const errorMsg = allOk ? null : Object.entries(results)
      .filter(([, r]) => !r.ok)
      .map(([p, r]) => `${p}: ${r.reason}`)
      .join('; ');

    const { rows: updated } = await pool.query(`
      UPDATE video_posting_queue
      SET status=$1, results_json=$2, error_message=$3, retry_count=$4
      WHERE id=$5 RETURNING *
    `, [
      finalStatus,
      JSON.stringify(results),
      errorMsg,
      item.retry_count + 1,
      params.id,
    ]);

    return Response.json({
      item: updated[0],
      results,
      summary: {
        total_platforms: item.platforms.length,
        succeeded: Object.values(results).filter(r => r.ok).length,
        failed: Object.values(results).filter(r => !r.ok).length,
      },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
