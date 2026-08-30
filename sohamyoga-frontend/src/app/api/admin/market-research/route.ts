import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Framework list — the 3 real research frameworks (17-layer forecasting,
 * new-entrant scorecard, existing-centre growth), each with its real topic
 * count, ordered by sort_order. Top level of the Framework -> Topic -> 4-tab
 * hierarchy; /admin/market-research/[frameworkSlug] drills into one.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const frameworks = await query<{
    id: string; slug: string; name: string; description: string; sort_order: number; created_at: string; topic_count: string;
  }>(
    `SELECT f.id, f.slug, f.name, f.description, f.sort_order, f.created_at, count(t.id)::text AS topic_count
     FROM research_framework f
     LEFT JOIN research_topic t ON t.framework_id = f.id
     GROUP BY f.id
     ORDER BY f.sort_order`,
  );

  return Response.json({
    frameworks: frameworks.rows.map(f => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      description: f.description,
      sortOrder: f.sort_order,
      createdAt: f.created_at,
      topicCount: Number(f.topic_count),
    })),
  });
}
