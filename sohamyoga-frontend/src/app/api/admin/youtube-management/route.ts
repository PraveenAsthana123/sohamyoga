import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const client = await pool.connect();
  try {
    const [accountRes, videosRes, shortsRes, analyticsRes, draftsRes] = await Promise.all([
      client.query(
        `SELECT id, platform, account_name, profile_url, avatar_url, status,
                connected_at, last_health_check_at, error_message
         FROM social_account WHERE platform = 'youtube' ORDER BY connected_at DESC LIMIT 1`
      ).catch(() => ({ rows: [] })),

      client.query(
        `SELECT id, platform, content_type, caption AS title, status, approval_status,
                impressions, clicks, likes, comments, shares, plays, published_at, scheduled_at
         FROM unified_content_item
         WHERE platform = 'youtube' AND content_type = 'video'
         ORDER BY COALESCE(published_at, scheduled_at, created_at) DESC LIMIT 100`
      ).catch(() => ({ rows: [] })),

      client.query(
        `SELECT id, platform, content_type, caption AS title, status, approval_status,
                impressions, clicks, likes, comments, shares, plays, published_at, scheduled_at
         FROM unified_content_item
         WHERE platform = 'youtube' AND content_type = 'short'
         ORDER BY COALESCE(published_at, scheduled_at, created_at) DESC LIMIT 100`
      ).catch(() => ({ rows: [] })),

      client.query(
        `SELECT id, platform, metric_key, metric_value, recorded_at
         FROM social_platform_analytics WHERE platform = 'youtube'
         ORDER BY recorded_at DESC LIMIT 200`
      ).catch(() => ({ rows: [] })),

      client.query(
        `SELECT id, content_type, master_text, status, default_schedule_at,
                generated_with_ai, tags, created_at, updated_at
         FROM social_content_draft WHERE platform ILIKE '%youtube%'
         ORDER BY created_at DESC LIMIT 50`
      ).catch(() => ({ rows: [] })),
    ]);

    type VideoRow = { impressions: number; plays: number; likes: number; comments: number; shares: number };
    const allVideos: VideoRow[] = [...videosRes.rows, ...shortsRes.rows];

    const summary = {
      accountStatus: accountRes.rows[0]?.status ?? 'disconnected',
      totalVideos: videosRes.rows.length,
      totalShorts: shortsRes.rows.length,
      totalImpressions: allVideos.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      totalPlays: allVideos.reduce((s, r) => s + Number(r.plays ?? 0), 0),
      totalEngagement: allVideos.reduce(
        (s, r) => s + Number(r.likes ?? 0) + Number(r.comments ?? 0) + Number(r.shares ?? 0),
        0
      ),
    };

    return NextResponse.json({
      account: accountRes.rows[0] ?? null,
      videos: videosRes.rows,
      shorts: shortsRes.rows,
      analytics: analyticsRes.rows,
      drafts: draftsRes.rows,
      summary,
    });
  } finally {
    client.release();
  }
}
