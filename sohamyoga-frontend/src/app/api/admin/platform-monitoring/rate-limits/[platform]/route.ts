import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

interface RateLimitRow {
  id: number;
  platform: string;
  endpoint_group: string | null;
  limit_total: number | null;
  limit_remaining: number | null;
  limit_reset_at: string | null;
  window_seconds: number | null;
  snapshot_at: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { platform: string } },
) {
  const { platform } = params;
  try {
    const result = await query<RateLimitRow>(
      `SELECT id, platform, endpoint_group, limit_total, limit_remaining,
              limit_reset_at, window_seconds, snapshot_at
       FROM platform_rate_limit_snapshot
       WHERE platform = $1 AND snapshot_at >= NOW() - INTERVAL '24 hours'
       ORDER BY snapshot_at DESC`,
      [platform],
    );
    return NextResponse.json({ platform, rows: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[rate-limits/platform]', err);
    return NextResponse.json({ error: 'Failed to fetch rate limit history' }, { status: 500 });
  }
}
