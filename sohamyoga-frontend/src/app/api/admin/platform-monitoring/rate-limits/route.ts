import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

interface RateLimitRow {
  platform: string;
  endpoint_group: string | null;
  limit_total: number | null;
  limit_remaining: number | null;
  limit_reset_at: string | null;
  window_seconds: number | null;
  snapshot_at: string;
}

export async function GET() {
  try {
    // Latest snapshot per platform per endpoint_group
    const result = await query<RateLimitRow>(
      `SELECT DISTINCT ON (platform, endpoint_group)
              platform, endpoint_group, limit_total, limit_remaining,
              limit_reset_at, window_seconds, snapshot_at
       FROM platform_rate_limit_snapshot
       ORDER BY platform, endpoint_group, snapshot_at DESC`,
    );

    // Group by platform
    const byPlatform: Record<string, {
      platform: string;
      groups: {
        endpoint_group: string | null;
        limit_total: number | null;
        limit_remaining: number | null;
        limit_reset_at: string | null;
        window_seconds: number | null;
        pct_used: number | null;
        snapshot_at: string;
      }[];
    }> = {};

    for (const row of result.rows) {
      if (!byPlatform[row.platform]) {
        byPlatform[row.platform] = { platform: row.platform, groups: [] };
      }
      const pctUsed =
        row.limit_total && row.limit_remaining !== null
          ? Math.round(((row.limit_total - row.limit_remaining) / row.limit_total) * 100)
          : null;
      byPlatform[row.platform].groups.push({
        endpoint_group: row.endpoint_group,
        limit_total: row.limit_total,
        limit_remaining: row.limit_remaining,
        limit_reset_at: row.limit_reset_at,
        window_seconds: row.window_seconds,
        pct_used: pctUsed,
        snapshot_at: row.snapshot_at,
      });
    }

    return NextResponse.json({ platforms: Object.values(byPlatform) });
  } catch (err) {
    console.error('[rate-limits GET]', err);
    return NextResponse.json({ error: 'Failed to fetch rate limits' }, { status: 500 });
  }
}
