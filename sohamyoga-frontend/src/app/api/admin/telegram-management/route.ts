import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const client = await pool.connect();
  try {
    const [accountRes, contentRes, draftsRes, analyticsRes, broadcastRes] = await Promise.all([
      client.query(
        `SELECT id, platform, account_name, profile_url, avatar_url, status,
                connected_at, last_health_check_at, error_message
         FROM social_account WHERE platform = 'telegram' ORDER BY connected_at DESC LIMIT 1`
      ).catch(() => ({ rows: [] })),

      client.query(
        `SELECT id, platform, content_type, caption AS title, status, approval_status,
                impressions, clicks, likes, comments, shares, published_at, scheduled_at
         FROM unified_content_item WHERE platform = 'telegram'
         ORDER BY COALESCE(published_at, scheduled_at, created_at) DESC LIMIT 100`
      ).catch(() => ({ rows: [] })),

      client.query(
        `SELECT id, content_type, master_text, status, default_schedule_at,
                generated_with_ai, tags, created_at, updated_at
         FROM social_content_draft WHERE platform ILIKE '%telegram%'
         ORDER BY created_at DESC LIMIT 100`
      ).catch(() => ({ rows: [] })),

      client.query(
        `SELECT id, platform, metric_key, metric_value, recorded_at
         FROM social_platform_analytics WHERE platform = 'telegram'
         ORDER BY recorded_at DESC LIMIT 200`
      ).catch(() => ({ rows: [] })),

      client.query(
        `SELECT smq.id, smq.platform, smq.ai_drafted_text AS content, smq.status,
                smq.published_at, smq.created_at,
                scd.default_schedule_at AS scheduled_at, scd.content_type
         FROM social_manual_queue smq
         LEFT JOIN social_content_draft scd ON scd.id = smq.draft_id
         WHERE smq.platform = 'telegram'
         ORDER BY smq.created_at DESC LIMIT 50`
      ).catch(() => ({ rows: [] })),
    ]);

    const contentItems: Array<{
      impressions: number; clicks: number; likes: number; comments: number; shares: number;
    }> = contentRes.rows;

    const summary = {
      accountStatus: accountRes.rows[0]?.status ?? 'disconnected',
      totalContentItems: contentItems.length,
      totalImpressions: contentItems.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      totalEngagement: contentItems.reduce(
        (s, r) => s + Number(r.likes ?? 0) + Number(r.comments ?? 0) + Number(r.shares ?? 0),
        0
      ),
    };

    return NextResponse.json({
      account: accountRes.rows[0] ?? null,
      contentItems: contentItems,
      drafts: draftsRes.rows,
      analytics: analyticsRes.rows,
      broadcasts: broadcastRes.rows,
      summary,
    });
  } finally {
    client.release();
  }
}
