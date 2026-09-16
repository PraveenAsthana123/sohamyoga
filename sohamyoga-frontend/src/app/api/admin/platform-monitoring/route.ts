import { NextRequest} from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
interface PlatformSummaryRow {
  platform: string;
  health_status: string | null;
  latency_ms: number | null;
  checked_at: string | null;
  error_count_24h: string;
  retry_pending: string;
  last_event_at: string | null;
  limit_total: number | null;
  limit_remaining: number | null;
}

export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    // Get all 36 platforms
    const platformsResult = await query<{ platform: string }>(
      `SELECT platform FROM ref_social_platform ORDER BY platform`,
    );
    const platforms = platformsResult.rows.map((r) => r.platform);

    // Latest health per platform
    const healthResult = await query<{
      platform: string;
      status: string;
      latency_ms: number | null;
      checked_at: string;
    }>(
      `SELECT DISTINCT ON (platform) platform, status, latency_ms, checked_at
       FROM platform_health_check
       ORDER BY platform, checked_at DESC`,
    );
    const healthMap = new Map(healthResult.rows.map((r) => [r.platform, r]));

    // Error count last 24h per platform
    const errorResult = await query<{ platform: string; error_count: string }>(
      `SELECT platform, COUNT(*) as error_count
       FROM platform_api_log
       WHERE is_error = true AND created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY platform`,
    );
    const errorMap = new Map(errorResult.rows.map((r) => [r.platform, parseInt(r.error_count, 10)]));

    // Retry pending per platform
    const retryResult = await query<{ platform: string; pending_count: string }>(
      `SELECT platform, COUNT(*) as pending_count
       FROM platform_retry_queue
       WHERE status IN ('pending', 'retrying')
       GROUP BY platform`,
    );
    const retryMap = new Map(retryResult.rows.map((r) => [r.platform, parseInt(r.pending_count, 10)]));

    // Last webhook event per platform
    const webhookResult = await query<{ platform: string; last_event_at: string }>(
      `SELECT DISTINCT ON (platform) platform, received_at as last_event_at
       FROM platform_webhook_event
       ORDER BY platform, received_at DESC`,
    );
    const webhookMap = new Map(webhookResult.rows.map((r) => [r.platform, r.last_event_at]));

    // Latest rate limit per platform
    const rateResult = await query<{
      platform: string;
      limit_total: number | null;
      limit_remaining: number | null;
    }>(
      `SELECT DISTINCT ON (platform) platform, limit_total, limit_remaining
       FROM platform_rate_limit_snapshot
       ORDER BY platform, snapshot_at DESC`,
    );
    const rateMap = new Map(rateResult.rows.map((r) => [r.platform, r]));

    const summary = platforms.map((platform) => {
      const health = healthMap.get(platform);
      const rate = rateMap.get(platform);
      const ratePct =
        rate?.limit_total && rate?.limit_remaining !== null && rate?.limit_remaining !== undefined
          ? Math.round(((rate.limit_total - rate.limit_remaining) / rate.limit_total) * 100)
          : null;

      return {
        platform,
        health_status: health?.status ?? 'unknown',
        latency_ms: health?.latency_ms ?? null,
        checked_at: health?.checked_at ?? null,
        error_count_24h: errorMap.get(platform) ?? 0,
        retry_pending: retryMap.get(platform) ?? 0,
        last_event_at: webhookMap.get(platform) ?? null,
        rate_limit_pct_used: ratePct,
        rate_limit_remaining: rate?.limit_remaining ?? null,
        rate_limit_total: rate?.limit_total ?? null,
      };
    });

    return Response.json({ platforms: summary, total: platforms.length });
  } catch (err) {
    console.error('[platform-monitoring]', err);
    // Tables may not exist yet
    const platformsResult = await query<{ platform: string }>(
      `SELECT platform FROM ref_social_platform ORDER BY platform`,
    ).catch(() => ({ rows: [] as { platform: string }[] }));

    return Response.json({
      platforms: platformsResult.rows.map((r) => ({
        platform: r.platform,
        health_status: 'unknown',
        latency_ms: null,
        checked_at: null,
        error_count_24h: 0,
        retry_pending: 0,
        last_event_at: null,
        rate_limit_pct_used: null,
        rate_limit_remaining: null,
        rate_limit_total: null,
      })),
      total: platformsResult.rows.length,
      note: 'Run /api/admin/platform-monitoring/seed to initialize tables',
    });
  }
}
