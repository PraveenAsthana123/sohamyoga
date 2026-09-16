import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    // Create tables
    await query(`
      CREATE TABLE IF NOT EXISTS platform_integration_config (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) UNIQUE NOT NULL,
        is_enabled BOOLEAN DEFAULT false,
        integration_mode VARCHAR(20) DEFAULT 'personal_oauth',
        rate_limit_strategy VARCHAR(20) DEFAULT 'conservative',
        retry_enabled BOOLEAN DEFAULT true,
        retry_max_attempts INT DEFAULT 3,
        retry_backoff_seconds INT DEFAULT 60,
        sandbox_mode BOOLEAN DEFAULT false,
        debug_mode BOOLEAN DEFAULT false,
        auto_refresh_tokens BOOLEAN DEFAULT true,
        webhook_secret VARCHAR(200),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS platform_system_account (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        account_type VARCHAR(30) NOT NULL,
        account_label VARCHAR(100),
        system_user_id VARCHAR(200),
        app_id VARCHAR(200),
        scopes_granted TEXT,
        token_env_var VARCHAR(100),
        token_expires_at TIMESTAMPTZ,
        token_last_refreshed_at TIMESTAMPTZ,
        token_status VARCHAR(20) DEFAULT 'unknown',
        is_primary BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS platform_webhook_config (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        webhook_url VARCHAR(500),
        events TEXT,
        is_active BOOLEAN DEFAULT false,
        verified BOOLEAN DEFAULT false,
        verify_token VARCHAR(200),
        last_event_at TIMESTAMPTZ,
        event_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS platform_customer_toggle (
        id SERIAL PRIMARY KEY,
        customer_id INT NOT NULL,
        platform VARCHAR(50) NOT NULL,
        is_enabled BOOLEAN DEFAULT true,
        enabled_by VARCHAR(20) DEFAULT 'admin',
        enabled_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(customer_id, platform)
      )
    `);

    // Seed default integration_config for all 36 platforms
    const platforms = await query<{ platform: string }>('SELECT platform FROM ref_social_platform ORDER BY platform');

    let seeded = 0;
    for (const row of platforms.rows) {
      const result = await query(
        `INSERT INTO platform_integration_config (platform, is_enabled, integration_mode, rate_limit_strategy, retry_enabled, retry_max_attempts, retry_backoff_seconds, sandbox_mode, debug_mode, auto_refresh_tokens)
         VALUES ($1, false, 'personal_oauth', 'conservative', true, 3, 60, false, false, true)
         ON CONFLICT (platform) DO NOTHING`,
        [row.platform]
      );
      if ((result.rowCount ?? 0) > 0) seeded++;
    }

    return Response.json({
      success: true,
      message: `Tables created. Seeded ${seeded} new platform configs (${platforms.rows.length} platforms total).`,
      tables: ['platform_integration_config', 'platform_system_account', 'platform_webhook_config', 'platform_customer_toggle'],
      platforms_seeded: seeded,
      platforms_total: platforms.rows.length,
    });
  } catch (err) {
    console.error('platform-integration seed error:', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
