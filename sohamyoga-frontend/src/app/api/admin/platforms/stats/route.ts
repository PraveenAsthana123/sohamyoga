// GET /api/admin/platforms/stats
// Returns per-platform content counts and setup status.
// Used by the All Platforms Hub page (/admin/platforms).

import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ALL_PLATFORM_KEYS } from '@/lib/platform-tab-config';

export async function GET(): Promise<NextResponse> {
  try {
    // Ensure tables exist (best-effort, unified_content_item created by platform-data route)
    await query(`
      CREATE TABLE IF NOT EXISTS unified_content_item (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform TEXT NOT NULL,
        content_type TEXT NOT NULL,
        title TEXT,
        status TEXT DEFAULT 'draft',
        impressions BIGINT DEFAULT 0,
        clicks BIGINT DEFAULT 0,
        likes BIGINT DEFAULT 0,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => { /* ignore if already exists */ });

    // Count content items per platform
    const countRes = await query<{ platform: string; cnt: string }>(
      `SELECT platform, COUNT(*)::text AS cnt
       FROM unified_content_item
       WHERE platform = ANY($1::text[])
       GROUP BY platform`,
      [ALL_PLATFORM_KEYS]
    );

    const countMap: Record<string, number> = {};
    for (const row of countRes.rows) countMap[row.platform] = Number(row.cnt);

    // Check which platforms have connected social accounts (postiz or custom)
    let connectedPlatforms: Set<string> = new Set();
    try {
      const acctRes = await query<{ platform: string }>(
        `SELECT DISTINCT platform FROM postiz_account WHERE status = 'active'`
      );
      connectedPlatforms = new Set(acctRes.rows.map((r) => r.platform));
    } catch {
      // postiz_account table may not exist yet — ignore
    }

    const stats = ALL_PLATFORM_KEYS.map((key) => ({
      platform: key,
      contentCount: countMap[key] ?? 0,
      setupStatus: connectedPlatforms.has(key)
        ? 'Connected'
        : countMap[key] > 0
        ? 'Manual Only'
        : 'Missing Credentials',
    }));

    return NextResponse.json({ stats, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[platforms/stats]', err);
    return NextResponse.json({ stats: [], error: String(err) }, { status: 500 });
  }
}
