// PlatformHealthCheckJob — every 5 minutes
// For each of the 36 platforms in ref_social_platform, insert a health_check row.
// For platforms with a known API endpoint, attempts a lightweight HEAD request.
// Keeps only last 1000 rows per platform.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

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

interface PlatformRow {
  platform: string;
}

export async function run(): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  // Ensure table exists
  await db.query(`
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

  const platformsResult = await db.query<PlatformRow>(
    `SELECT platform FROM ref_social_platform ORDER BY platform`,
  );
  const platforms = platformsResult.rows.map((r) => r.platform);

  console.log(`[platform-health-check] Checking ${platforms.length} platforms`);
  let healthy = 0;
  let unknown = 0;
  let degraded = 0;
  let down = 0;

  for (const platform of platforms) {
    const endpoint = HEALTH_ENDPOINTS[platform] ?? null;
    let status = 'unknown';
    let latencyMs: number | null = null;
    let httpStatus: number | null = null;
    let errorMessage: string | null = null;

    if (endpoint) {
      const start = Date.now();
      try {
        const res = await fetch(endpoint, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        latencyMs = Date.now() - start;
        httpStatus = res.status;
        if (res.status < 400) {
          status = 'healthy';
          healthy++;
        } else if (res.status < 500) {
          status = 'degraded';
          degraded++;
          errorMessage = `HTTP ${res.status}`;
        } else {
          status = 'down';
          down++;
          errorMessage = `HTTP ${res.status}`;
        }
      } catch (err) {
        latencyMs = Date.now() - start;
        status = 'down';
        down++;
        errorMessage = err instanceof Error ? err.message : 'Network error';
      }
    } else {
      status = 'unknown';
      unknown++;
    }

    await db.query(
      `INSERT INTO platform_health_check
         (platform, checked_at, status, latency_ms, error_message, http_status, api_endpoint_checked)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
      [platform, status, latencyMs, errorMessage, httpStatus, endpoint ?? null],
    );

    // Prune old rows — keep last 1000 per platform
    await db.query(
      `DELETE FROM platform_health_check
       WHERE platform = $1
         AND id NOT IN (
           SELECT id FROM platform_health_check
           WHERE platform = $1
           ORDER BY checked_at DESC
           LIMIT 1000
         )`,
      [platform],
    );
  }

  console.log(
    `[platform-health-check] Done. healthy=${healthy} degraded=${degraded} down=${down} unknown=${unknown}`,
  );
  await db.end();
}
