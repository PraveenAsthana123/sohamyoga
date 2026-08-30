import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Topics within one research framework (looked up by slug, e.g.
 * "new-entrant-scorecard"), ordered by layer_number. 404s when the
 * framework slug doesn't match a seeded framework.
 */
export async function GET(req: NextRequest, { params }: { params: { frameworkSlug: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const frameworkSlug = params.frameworkSlug;

  const frameworkResult = await query<{
    id: string; slug: string; name: string; description: string; sort_order: number;
  }>(
    `SELECT id, slug, name, description, sort_order FROM research_framework WHERE slug = $1`,
    [frameworkSlug],
  );
  const framework = frameworkResult.rows[0];
  if (!framework) return Response.json({ error: `Unknown research framework "${frameworkSlug}".` }, { status: 404 });

  const topics = await query<{
    id: string; slug: string; name: string; layer_number: number; summary: string; job_name: string | null; created_at: string;
  }>(
    `SELECT id, slug, name, layer_number, summary, job_name, created_at
     FROM research_topic
     WHERE framework_id = $1
     ORDER BY layer_number`,
    [framework.id],
  );

  return Response.json({
    framework: {
      id: framework.id,
      slug: framework.slug,
      name: framework.name,
      description: framework.description,
      sortOrder: framework.sort_order,
    },
    topics: topics.rows.map(t => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      layerNumber: t.layer_number,
      summary: t.summary,
      jobName: t.job_name,
      createdAt: t.created_at,
    })),
  });
}
