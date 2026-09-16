import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const result = await query<{
      platform: string;
      display_name: string;
      category: string;
      is_enabled: boolean;
      integration_mode: string;
      rate_limit_strategy: string;
      retry_enabled: boolean;
      sandbox_mode: boolean;
      debug_mode: boolean;
      auto_refresh_tokens: boolean;
      webhook_secret: string | null;
      notes: string | null;
      updated_at: string;
      system_account_count: string;
      webhook_count: string;
      active_webhook_count: string;
      customer_enabled_count: string;
    }>(`
      SELECT
        COALESCE(pic.platform, rsp.platform) AS platform,
        COALESCE(rsp.display_name, rsp.platform) AS display_name,
        COALESCE(rsp.category, 'other') AS category,
        COALESCE(pic.is_enabled, false) AS is_enabled,
        COALESCE(pic.integration_mode, 'personal_oauth') AS integration_mode,
        COALESCE(pic.rate_limit_strategy, 'conservative') AS rate_limit_strategy,
        COALESCE(pic.retry_enabled, true) AS retry_enabled,
        COALESCE(pic.sandbox_mode, false) AS sandbox_mode,
        COALESCE(pic.debug_mode, false) AS debug_mode,
        COALESCE(pic.auto_refresh_tokens, true) AS auto_refresh_tokens,
        pic.webhook_secret,
        pic.notes,
        pic.updated_at,
        COALESCE(sa.system_account_count, 0)::TEXT AS system_account_count,
        COALESCE(wh.webhook_count, 0)::TEXT AS webhook_count,
        COALESCE(wh.active_webhook_count, 0)::TEXT AS active_webhook_count,
        COALESCE(ct.customer_enabled_count, 0)::TEXT AS customer_enabled_count
      FROM ref_social_platform rsp
      LEFT JOIN platform_integration_config pic ON pic.platform = rsp.platform
      LEFT JOIN (
        SELECT platform, COUNT(*) AS system_account_count FROM platform_system_account GROUP BY platform
      ) sa ON sa.platform = rsp.platform
      LEFT JOIN (
        SELECT platform,
               COUNT(*) AS webhook_count,
               COUNT(*) FILTER (WHERE is_active = true) AS active_webhook_count
        FROM platform_webhook_config GROUP BY platform
      ) wh ON wh.platform = rsp.platform
      LEFT JOIN (
        SELECT platform, COUNT(*) FILTER (WHERE is_enabled = true) AS customer_enabled_count
        FROM platform_customer_toggle GROUP BY platform
      ) ct ON ct.platform = rsp.platform
      ORDER BY
        CASE WHEN pic.is_enabled THEN 0 ELSE 1 END,
        rsp.display_name
    `);

    return NextResponse.json({ platforms: result.rows });
  } catch (err) {
    console.error('platform-integration GET error:', err);
    return NextResponse.json({ error: 'Failed to load platform integrations' }, { status: 500 });
  }
}
