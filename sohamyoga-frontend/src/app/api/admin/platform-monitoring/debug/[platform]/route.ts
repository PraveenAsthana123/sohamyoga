import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
interface EnvVarCheck {
  name: string;
  set: boolean;
}

interface DebugResult {
  platform: string;
  env_check: { vars: EnvVarCheck[]; all_set: boolean };
  connectivity: { reachable: boolean; latency_ms: number | null; http_status: number | null; endpoint: string | null };
  last_log: Record<string, unknown> | null;
  rate_limit: Record<string, unknown> | null;
  health_status: Record<string, unknown> | null;
  recommendations: string[];
}

const PLATFORM_ENV_VARS: Record<string, string[]> = {
  facebook: ['FACEBOOK_PAGE_ACCESS_TOKEN', 'FACEBOOK_PAGE_ID', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
  instagram: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID'],
  twitter: ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET'],
  x_twitter: ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET'],
  linkedin: ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_ORGANIZATION_ID'],
  youtube: ['YOUTUBE_API_KEY', 'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
  tiktok: ['TIKTOK_ACCESS_TOKEN', 'TIKTOK_CLIENT_KEY'],
  discord: ['DISCORD_BOT_TOKEN', 'DISCORD_WEBHOOK_URL'],
  slack: ['SLACK_BOT_TOKEN', 'SLACK_WEBHOOK_URL'],
  github: ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'],
  pinterest: ['PINTEREST_ACCESS_TOKEN'],
  reddit: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_REFRESH_TOKEN'],
  whatsapp: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'],
  telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
};

const HEALTH_ENDPOINTS: Record<string, string> = {
  facebook: 'https://graph.facebook.com/v18.0/',
  instagram: 'https://graph.instagram.com/v18.0/',
  twitter: 'https://api.twitter.com/2/tweets',
  x_twitter: 'https://api.twitter.com/2/tweets',
  linkedin: 'https://api.linkedin.com/v2/',
  youtube: 'https://www.googleapis.com/youtube/v3/',
  github: 'https://api.github.com/',
  gitlab: 'https://gitlab.com/api/v4/',
  pinterest: 'https://api.pinterest.com/v5/',
  reddit: 'https://www.reddit.com/api/v1/',
  discord: 'https://discord.com/api/v10/',
  tiktok: 'https://open.tiktokapis.com/v2/',
  medium: 'https://api.medium.com/v1/',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { platform } = await params;

  const result: DebugResult = {
    platform,
    env_check: { vars: [], all_set: false },
    connectivity: { reachable: false, latency_ms: null, http_status: null, endpoint: null },
    last_log: null,
    rate_limit: null,
    health_status: null,
    recommendations: [],
  };

  // 1. Check env vars
  const envVars = PLATFORM_ENV_VARS[platform] ?? [];
  if (envVars.length === 0) {
    result.env_check.vars = [{ name: 'No known env vars for this platform', set: false }];
    result.recommendations.push(`Document required environment variables for ${platform} in PLATFORM_ENV_VARS`);
  } else {
    result.env_check.vars = envVars.map((v) => ({ name: v, set: Boolean(process.env[v]) }));
    result.env_check.all_set = result.env_check.vars.every((v) => v.set);
    const missing = result.env_check.vars.filter((v) => !v.set);
    for (const m of missing) {
      result.recommendations.push(`Set environment variable: ${m.name}`);
    }
  }

  // 2. Connectivity check
  const endpoint = HEALTH_ENDPOINTS[platform] ?? null;
  result.connectivity.endpoint = endpoint;
  if (endpoint) {
    const start = Date.now();
    try {
      const res = await fetch(endpoint, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      result.connectivity.latency_ms = Date.now() - start;
      result.connectivity.http_status = res.status;
      result.connectivity.reachable = res.status < 500;
      if (!result.connectivity.reachable) {
        result.recommendations.push(`${platform} API returned ${res.status} — check API status page`);
      } else if (result.connectivity.latency_ms > 2000) {
        result.recommendations.push(`High latency to ${platform} API (${result.connectivity.latency_ms}ms) — check network`);
      }
    } catch {
      result.connectivity.latency_ms = Date.now() - start;
      result.connectivity.reachable = false;
      result.recommendations.push(`Cannot reach ${platform} API at ${endpoint} — check network/firewall`);
    }
  } else {
    result.recommendations.push(`No known health endpoint for ${platform} — add to HEALTH_ENDPOINTS`);
  }

  // 3. Last API log
  try {
    const logResult = await query<Record<string, unknown>>(
      `SELECT id, endpoint, http_method, response_status, duration_ms, is_error, error_type, triggered_by, created_at
       FROM platform_api_log
       WHERE platform = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [platform],
    );
    result.last_log = logResult.rows[0] ?? null;
    if (result.last_log?.is_error) {
      result.recommendations.push(`Last API call resulted in error type: ${result.last_log.error_type ?? 'unknown'} — investigate`);
    }
  } catch {
    result.last_log = null;
  }

  // 4. Rate limit status
  try {
    const rateResult = await query<{
      endpoint_group: string | null;
      limit_total: number | null;
      limit_remaining: number | null;
      snapshot_at: string;
    }>(
      `SELECT endpoint_group, limit_total, limit_remaining, snapshot_at
       FROM platform_rate_limit_snapshot
       WHERE platform = $1
       ORDER BY snapshot_at DESC
       LIMIT 1`,
      [platform],
    );
    if (rateResult.rows.length > 0) {
      const r = rateResult.rows[0];
      const pct =
        r.limit_total && r.limit_remaining !== null
          ? Math.round(((r.limit_total - r.limit_remaining) / r.limit_total) * 100)
          : null;
      result.rate_limit = { ...r, pct_used: pct };
      if (pct !== null && pct > 80) {
        result.recommendations.push(`Rate limit at ${pct}% for ${r.endpoint_group ?? 'default'} — reduce posting frequency`);
      }
    }
  } catch {
    result.rate_limit = null;
  }

  // 5. Health status
  try {
    const healthResult = await query<{
      status: string;
      latency_ms: number | null;
      checked_at: string;
      error_message: string | null;
    }>(
      `SELECT status, latency_ms, checked_at, error_message
       FROM platform_health_check
       WHERE platform = $1
       ORDER BY checked_at DESC
       LIMIT 1`,
      [platform],
    );
    result.health_status = healthResult.rows[0] ?? null;
    if (result.health_status?.status === 'down') {
      result.recommendations.push(`Platform is marked as DOWN in health checks — requires immediate attention`);
    } else if (result.health_status?.status === 'degraded') {
      result.recommendations.push(`Platform is degraded — monitor closely and reduce load`);
    }
  } catch {
    result.health_status = null;
  }

  if (result.recommendations.length === 0) {
    result.recommendations.push(`${platform} appears healthy — no immediate action required`);
  }

  return Response.json(result);
}
