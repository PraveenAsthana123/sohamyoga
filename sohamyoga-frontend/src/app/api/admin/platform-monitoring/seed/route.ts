import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    // Create all 5 tables
    await query(`
      CREATE TABLE IF NOT EXISTS platform_api_log (
        id BIGSERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        endpoint VARCHAR(300) NOT NULL,
        http_method VARCHAR(10),
        request_headers JSONB DEFAULT '{}',
        request_body TEXT,
        response_status INT,
        response_body TEXT,
        response_headers JSONB DEFAULT '{}',
        duration_ms INT,
        is_error BOOLEAN DEFAULT false,
        error_type VARCHAR(100),
        triggered_by VARCHAR(100),
        content_item_id INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS platform_health_check (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        checked_at TIMESTAMPTZ DEFAULT NOW(),
        status VARCHAR(20) NOT NULL,
        latency_ms INT,
        error_message TEXT,
        http_status INT,
        api_endpoint_checked VARCHAR(200)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS platform_rate_limit_snapshot (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        endpoint_group VARCHAR(100),
        limit_total INT,
        limit_remaining INT,
        limit_reset_at TIMESTAMPTZ,
        window_seconds INT,
        snapshot_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS platform_webhook_event (
        id BIGSERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        event_type VARCHAR(100),
        event_id VARCHAR(200),
        payload JSONB DEFAULT '{}',
        raw_body TEXT,
        signature_valid BOOLEAN,
        processed BOOLEAN DEFAULT false,
        processing_error TEXT,
        received_at TIMESTAMPTZ DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS platform_retry_queue (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        operation_type VARCHAR(50),
        payload JSONB DEFAULT '{}',
        original_error TEXT,
        attempt_count INT DEFAULT 0,
        max_attempts INT DEFAULT 3,
        next_retry_at TIMESTAMPTZ DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'pending',
        last_error TEXT,
        content_item_id INT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Fetch all 36 platforms
    const platformsResult = await query<{ platform: string }>(
      `SELECT platform FROM ref_social_platform ORDER BY platform`,
    );
    const platforms = platformsResult.rows.map((r) => r.platform);

    // Seed 72 health_check rows (2 per platform: 1 healthy, 1 degraded/healthy)
    const statuses = ['healthy', 'healthy', 'healthy', 'healthy', 'degraded', 'down', 'healthy', 'healthy', 'unknown'];
    for (const platform of platforms) {
      const s1 = 'healthy';
      const s2 = statuses[Math.floor(Math.random() * statuses.length)];
      const lat1 = Math.floor(Math.random() * 200 + 50);
      const lat2 = Math.floor(Math.random() * 400 + 100);
      const ago1 = Math.floor(Math.random() * 60 + 5);
      const ago2 = Math.floor(Math.random() * 300 + 60);

      await query(
        `INSERT INTO platform_health_check (platform, checked_at, status, latency_ms, http_status, api_endpoint_checked)
         VALUES ($1, NOW() - ($2 || ' minutes')::INTERVAL, $3, $4, 200, $5)`,
        [platform, ago1.toString(), s1, lat1, `https://api.${platform}.com/`],
      );
      await query(
        `INSERT INTO platform_health_check (platform, checked_at, status, latency_ms, http_status, api_endpoint_checked, error_message)
         VALUES ($1, NOW() - ($2 || ' minutes')::INTERVAL, $3, $4, $5, $6, $7)`,
        [
          platform,
          ago2.toString(),
          s2,
          lat2,
          s2 === 'healthy' ? 200 : s2 === 'degraded' ? 503 : 0,
          `https://api.${platform}.com/`,
          s2 === 'healthy' ? null : `Simulated ${s2} state`,
        ],
      );
    }

    // Seed 36 rate_limit_snapshot rows (1 per platform)
    const endpointGroups = ['posts', 'ads', 'analytics'];
    for (const platform of platforms) {
      const group = endpointGroups[Math.floor(Math.random() * endpointGroups.length)];
      const total = [100, 200, 500, 1000][Math.floor(Math.random() * 4)];
      const remaining = Math.floor(Math.random() * total);
      await query(
        `INSERT INTO platform_rate_limit_snapshot (platform, endpoint_group, limit_total, limit_remaining, limit_reset_at, window_seconds)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour', 3600)`,
        [platform, group, total, remaining],
      );
    }

    // Seed 5 retry_queue rows with pending status
    const samplePlatforms = platforms.slice(0, 5);
    const opTypes = ['post_content', 'sync_analytics', 'send_message', 'webhook_call', 'post_content'];
    const errors = [
      'Rate limit exceeded',
      'Auth token expired',
      'Network timeout after 30s',
      'Server returned 503',
      'Invalid payload format',
    ];
    for (let i = 0; i < 5; i++) {
      await query(
        `INSERT INTO platform_retry_queue (platform, operation_type, payload, original_error, attempt_count, max_attempts, next_retry_at, status, last_error)
         VALUES ($1, $2, $3, $4, $5, 3, NOW() + ($6 || ' minutes')::INTERVAL, 'pending', $4)`,
        [
          samplePlatforms[i],
          opTypes[i],
          JSON.stringify({ test: true, item: i }),
          errors[i],
          i,
          (i * 10).toString(),
        ],
      );
    }

    return NextResponse.json({
      success: true,
      message: 'All 5 tables created and seeded',
      platforms: platforms.length,
      health_rows: platforms.length * 2,
      rate_limit_rows: platforms.length,
      retry_queue_rows: 5,
    });
  } catch (err) {
    console.error('[platform-monitoring/seed]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Seed failed' },
      { status: 500 },
    );
  }
}
