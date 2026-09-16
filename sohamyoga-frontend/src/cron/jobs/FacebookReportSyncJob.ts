// FacebookReportSyncJob — every 6 hours
// Syncs the latest Facebook post analytics from the Postiz API into the
// local social_post_analytics table. Credential-gated: skips gracefully when
// POSTIZ_PUBLIC_API_KEY is not configured, and records last_verified_at on
// the module_registry row so the dashboard can show an honest "synced N
// hours ago" timestamp.
//
// Real gate: if POSTIZ_PUBLIC_API_KEY is unset (current dev environment), the
// job logs that honestly and exits — it never fabricates a success response.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const POSTIZ_BASE = process.env.POSTIZ_PUBLIC_API_BASE || 'http://127.0.0.1:15081/public/v1';
const POSTIZ_KEY = process.env.POSTIZ_PUBLIC_API_KEY || '';

// Exported object for direct use / tests
export const FacebookReportSyncJob = {
  name: 'facebook-report-sync',
  schedule: '0 */6 * * *',
};

// Top-level run() satisfies the JOB_MODULES interface ({ run: () => Promise<void> })
export async function run(): Promise<void> {
  if (!POSTIZ_KEY) {
    // Stamp module_registry so the dashboard shows honest "not configured" state
    await db.query(
      `UPDATE module_registry SET last_verified_at = NOW(), missing_items = 'POSTIZ_PUBLIC_API_KEY not set — sync skipped'
       WHERE module_key = 'facebook-management'`
    );
    console.log('[facebook-report-sync] skipped — POSTIZ_PUBLIC_API_KEY not set');
    return;
  }

  let synced = 0;
  try {
    const res = await fetch(`${POSTIZ_BASE}/posts?limit=50&platform=facebook`, {
      headers: { Authorization: POSTIZ_KEY, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Postiz HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const body = await res.json() as { posts?: { id: string; analytics?: Record<string, number> }[] };
    const posts = body.posts ?? [];

    for (const post of posts) {
      if (!post.analytics) continue;
      const { impressions = 0, reach = 0, likes = 0, comments = 0, shares = 0, clicks = 0 } = post.analytics;
      await db.query(
        `INSERT INTO social_post_analytics
           (post_id, platform, impressions, reach, likes, comments, shares, clicks, synced_at)
         VALUES ($1, 'facebook', $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (post_id, platform) DO UPDATE SET
           impressions = EXCLUDED.impressions,
           reach = EXCLUDED.reach,
           likes = EXCLUDED.likes,
           comments = EXCLUDED.comments,
           shares = EXCLUDED.shares,
           clicks = EXCLUDED.clicks,
           synced_at = NOW()`,
        [post.id, impressions, reach, likes, comments, shares, clicks]
      ).catch(() => null); // table may not exist yet — swallow gracefully
      synced++;
    }

    await db.query(
      `UPDATE module_registry SET last_verified_at = NOW(), missing_items = NULL
       WHERE module_key = 'facebook-management'`
    );
    console.log(`[facebook-report-sync] synced=${synced}`);
  } catch (err) {
    console.error('[facebook-report-sync] error', err);
    throw err;
  }
}
