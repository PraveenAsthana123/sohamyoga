import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ platform: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { platform } = await params;

  try {
    const [configResult, accountsResult, webhooksResult, togglesResult] = await Promise.all([
      query<{
        id: number;
        platform: string;
        is_enabled: boolean;
        integration_mode: string;
        rate_limit_strategy: string;
        retry_enabled: boolean;
        retry_max_attempts: number;
        retry_backoff_seconds: number;
        sandbox_mode: boolean;
        debug_mode: boolean;
        auto_refresh_tokens: boolean;
        webhook_secret: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
        display_name: string;
        category: string;
      }>(`
        SELECT pic.*, rsp.display_name, COALESCE(rsp.category, 'other') AS category
        FROM ref_social_platform rsp
        LEFT JOIN platform_integration_config pic ON pic.platform = rsp.platform
        WHERE rsp.platform = $1
      `, [platform]),

      query<{
        id: number;
        platform: string;
        account_type: string;
        account_label: string | null;
        system_user_id: string | null;
        app_id: string | null;
        scopes_granted: string | null;
        token_env_var: string | null;
        token_expires_at: string | null;
        token_last_refreshed_at: string | null;
        token_status: string;
        is_primary: boolean;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>('SELECT * FROM platform_system_account WHERE platform = $1 ORDER BY is_primary DESC, created_at DESC', [platform]),

      query<{
        id: number;
        platform: string;
        webhook_url: string | null;
        events: string | null;
        is_active: boolean;
        verified: boolean;
        verify_token: string | null;
        last_event_at: string | null;
        event_count: number;
        created_at: string;
        updated_at: string;
      }>('SELECT * FROM platform_webhook_config WHERE platform = $1 ORDER BY created_at DESC', [platform]),

      query<{
        customer_id: number;
        is_enabled: boolean;
        enabled_by: string;
        enabled_at: string;
      }>('SELECT customer_id, is_enabled, enabled_by, enabled_at FROM platform_customer_toggle WHERE platform = $1 ORDER BY enabled_at DESC', [platform]),
    ]);

    if (configResult.rows.length === 0) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    return NextResponse.json({
      config: configResult.rows[0],
      system_accounts: accountsResult.rows,
      webhooks: webhooksResult.rows,
      customer_toggles: togglesResult.rows,
    });
  } catch (err) {
    console.error(`platform-integration GET [${platform}] error:`, err);
    return NextResponse.json({ error: 'Failed to load platform details' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { platform } = await params;

  try {
    const body = await req.json() as Record<string, unknown>;

    const allowed = [
      'is_enabled', 'integration_mode', 'rate_limit_strategy',
      'retry_enabled', 'retry_max_attempts', 'retry_backoff_seconds',
      'sandbox_mode', 'debug_mode', 'auto_refresh_tokens',
      'webhook_secret', 'notes',
    ];

    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = $${idx}`);
        vals.push(body[key]);
        idx++;
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    sets.push(`updated_at = NOW()`);
    vals.push(platform);

    const result = await query(
      `UPDATE platform_integration_config SET ${sets.join(', ')} WHERE platform = $${idx} RETURNING *`,
      vals
    );

    if ((result.rowCount ?? 0) === 0) {
      // Upsert if no row exists yet
      const upsertResult = await query(
        `INSERT INTO platform_integration_config (platform, ${Object.keys(body).filter(k => allowed.includes(k)).join(', ')})
         VALUES ($1, ${Object.keys(body).filter(k => allowed.includes(k)).map((_, i) => `$${i + 2}`).join(', ')})
         ON CONFLICT (platform) DO UPDATE SET ${sets.join(', ')}
         RETURNING *`,
        [platform, ...Object.values(body).filter((_, i) => allowed.includes(Object.keys(body)[i]))]
      );
      return NextResponse.json({ config: upsertResult.rows[0] });
    }

    return NextResponse.json({ config: result.rows[0] });
  } catch (err) {
    console.error(`platform-integration PATCH [${platform}] error:`, err);
    return NextResponse.json({ error: 'Failed to update platform config' }, { status: 500 });
  }
}
