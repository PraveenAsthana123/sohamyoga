import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real github_scout_candidate rows — the user's seeded shortlist plus anything GitHubRepoScoutJob has discovered since. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const result = await query<{
    full_name: string; url: string; stars: number | null; description: string | null;
    last_pushed_at: string | null; matched_query: string | null; source: string; relevance_note: string | null;
  }>(
    `SELECT full_name, url, stars, description, last_pushed_at, matched_query, source, relevance_note
     FROM github_scout_candidate
     ORDER BY source ASC, stars DESC NULLS LAST, full_name ASC`,
  );

  return Response.json({
    candidates: result.rows.map(r => ({
      fullName: r.full_name,
      url: r.url,
      stars: r.stars,
      description: r.description,
      lastPushedAt: r.last_pushed_at,
      matchedQuery: r.matched_query,
      source: r.source,
      relevanceNote: r.relevance_note,
    })),
  });
}
