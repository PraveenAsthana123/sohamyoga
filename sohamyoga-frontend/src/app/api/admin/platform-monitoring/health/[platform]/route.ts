import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

interface HealthRow {
  id: number;
  platform: string;
  checked_at: string;
  status: string;
  latency_ms: number | null;
  error_message: string | null;
  http_status: number | null;
  api_endpoint_checked: string | null;
  hour_bucket: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { platform: string } },
) {
  const { platform } = params;
  try {
    const result = await query<HealthRow>(
      `SELECT id, platform, checked_at, status, latency_ms, error_message, http_status, api_endpoint_checked,
              date_trunc('hour', checked_at) as hour_bucket
       FROM platform_health_check
       WHERE platform = $1
       ORDER BY checked_at DESC
       LIMIT 100`,
      [platform],
    );

    // Group by hour for timeline
    const byHour: Record<string, { hour: string; statuses: string[]; avg_latency: number | null }> = {};
    for (const row of result.rows) {
      const h = row.hour_bucket;
      if (!byHour[h]) byHour[h] = { hour: h, statuses: [], avg_latency: null };
      byHour[h].statuses.push(row.status);
    }

    // Compute avg latency per hour
    const hourlyResult = await query<{ hour_bucket: string; avg_latency: string; count: string }>(
      `SELECT date_trunc('hour', checked_at) as hour_bucket,
              AVG(latency_ms) as avg_latency,
              COUNT(*) as count
       FROM platform_health_check
       WHERE platform = $1 AND checked_at >= NOW() - INTERVAL '24 hours'
       GROUP BY hour_bucket
       ORDER BY hour_bucket DESC`,
      [platform],
    );

    return NextResponse.json({
      platform,
      rows: result.rows,
      hourly: hourlyResult.rows,
    });
  } catch (err) {
    console.error('[health/platform]', err);
    return NextResponse.json({ error: 'Failed to fetch platform health' }, { status: 500 });
  }
}
