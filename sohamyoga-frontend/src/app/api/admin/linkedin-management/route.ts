import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const type = searchParams.get('type');

  let q = 'SELECT * FROM linkedin_post WHERE 1=1';
  const p: (string | number)[] = [];
  let i = 1;
  if (status) { q += ` AND status=$${i++}`; p.push(status); }
  if (type) { q += ` AND post_type=$${i++}`; p.push(type); }
  q += ' ORDER BY created_at DESC LIMIT 100';

  const { rows } = await pool.query(q, p);
  const stats = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER(WHERE status='published') AS published,
      COUNT(*) FILTER(WHERE status='scheduled') AS scheduled,
      COUNT(*) FILTER(WHERE status='draft') AS draft,
      COALESCE(SUM(impressions),0) AS impressions,
      COALESCE(SUM(likes),0) AS likes,
      COALESCE(AVG(engagement_rate) FILTER(WHERE engagement_rate > 0), 0) AS avg_engagement_rate
    FROM linkedin_post
  `);

  return Response.json({ posts: rows, stats: stats.rows[0] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  try {
    const b = await req.json() as {
      title?: string;
      content: string;
      post_type?: string;
      status?: string;
      scheduled_at?: string | null;
      target_audience?: string;
      hashtags?: string;
      media_url?: string | null;
      ai_generated?: boolean;
    };

    const { rows } = await pool.query(
      `INSERT INTO linkedin_post
         (title, content, post_type, status, scheduled_at, target_audience, hashtags, media_url, ai_generated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        b.title ?? null,
        b.content,
        b.post_type ?? 'text',
        b.status ?? 'draft',
        b.scheduled_at ?? null,
        b.target_audience ?? 'connections',
        b.hashtags ?? '',
        b.media_url ?? null,
        b.ai_generated ?? false,
      ]
    );

    return Response.json({ post: rows[0] }, { status: 201 });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
