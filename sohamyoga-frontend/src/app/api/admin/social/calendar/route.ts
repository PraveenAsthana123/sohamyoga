import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Content Calendar -- previously only a flat draft/approval list
// existed (scheduler page); no date-grid view of scheduled/published posts
// across platforms. Pure aggregation of real social_post.scheduled_at, no
// new table.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !to) return Response.json({ error: 'from and to query params (ISO dates) are required.' }, { status: 400 });

  const rows = await query<{
    id: string; platform: string; status: string; scheduled_at: string; published_at: string | null;
    master_text: string | null;
  }>(
    `SELECT sp.id, sp.platform, sp.status, sp.scheduled_at, sp.published_at, d.master_text
     FROM social_post sp
     LEFT JOIN social_content_draft d ON d.id = sp.draft_id
     WHERE sp.scheduled_at >= $1 AND sp.scheduled_at < $2
     ORDER BY sp.scheduled_at ASC`,
    [from, to],
  );

  return Response.json({
    posts: rows.rows.map(r => ({
      id: r.id, platform: r.platform, status: r.status, scheduledAt: r.scheduled_at, publishedAt: r.published_at,
      excerpt: r.master_text ? r.master_text.slice(0, 80) : null,
    })),
  });
}
