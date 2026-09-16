export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database not configured.' }, { status: 503 });

  const { slug } = params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: verticals } = await client.query(
      'SELECT * FROM industry_verticals WHERE slug = $1',
      [slug],
    );
    if (!verticals.length) return Response.json({ error: 'Vertical not found.' }, { status: 404 });

    const [campaigns, hooks, reports] = await Promise.all([
      client.query('SELECT * FROM vertical_campaigns WHERE vertical_slug = $1 ORDER BY created_at', [slug]),
      client.query('SELECT * FROM vertical_content_hooks WHERE vertical_slug = $1 ORDER BY performance_score DESC, created_at', [slug]),
      client.query('SELECT * FROM vertical_reports WHERE vertical_slug = $1 ORDER BY created_at DESC LIMIT 20', [slug]),
    ]);

    return Response.json({
      vertical: verticals[0],
      campaigns: campaigns.rows,
      hooks: hooks.rows,
      reports: reports.rows,
    });
  } finally {
    client.release();
  }
}
