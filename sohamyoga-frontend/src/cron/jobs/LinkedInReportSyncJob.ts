// LinkedInReportSyncJob — every 6 hours
// Syncs LinkedIn post analytics from the Postiz API into the local
// social_post_analytics table. Credential-gated: skips gracefully when
// POSTIZ_PUBLIC_API_KEY is not configured.
//
// LinkedIn publishing is handled by PostizSocialAutoPublishJob (the
// linkedin/linkedin-page provider in Postiz). This job mirrors what
// FacebookReportSyncJob does: pull the latest engagement numbers from Postiz
// for the linkedin platform and upsert them locally.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const POSTIZ_BASE = process.env.POSTIZ_PUBLIC_API_BASE || 'http://127.0.0.1:15081/public/v1';
const POSTIZ_KEY = process.env.POSTIZ_PUBLIC_API_KEY || '';

export const LinkedInReportSyncJob = {
  name: 'linkedin-report-sync',
  schedule: '0 */6 * * *',
};

export async function run(): Promise<void> {
  if (!POSTIZ_KEY) {
    await db.query(
      `UPDATE module_registry SET last_verified_at = NOW(), missing_items = 'POSTIZ_PUBLIC_API_KEY not set — sync skipped'
       WHERE module_key = 'linkedin-management'`
    );
    console.log('[linkedin-report-sync] skipped — POSTIZ_PUBLIC_API_KEY not set');
    return;
  }

  let synced = 0;
  try {
    const res = await fetch(`${POSTIZ_BASE}/posts?limit=50&platform=linkedin`, {
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
         VALUES ($1, 'linkedin', $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (post_id, platform) DO UPDATE SET
           impressions = EXCLUDED.impressions,
           reach = EXCLUDED.reach,
           likes = EXCLUDED.likes,
           comments = EXCLUDED.comments,
           shares = EXCLUDED.shares,
           clicks = EXCLUDED.clicks,
           synced_at = NOW()`,
        [post.id, impressions, reach, likes, comments, shares, clicks]
      ).catch(() => null);
      synced++;
    }

    await db.query(
      `UPDATE module_registry SET last_verified_at = NOW(), missing_items = NULL
       WHERE module_key = 'linkedin-management'`
    );
    console.log(`[linkedin-report-sync] synced=${synced}`);
  } catch (err) {
    console.error('[linkedin-report-sync] error', err);
    throw err;
  }
}
