import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const sp = req.nextUrl.searchParams;
    const weekStart = sp.get('week_start') ?? new Date().toISOString().split('T')[0];
    const weekEnd = new Date(new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await query(
      `SELECT id, item_type, platform, content_type, caption, headline, status,
              approval_status, scheduled_at, impressions, likes, spend
       FROM unified_content_item
       WHERE status != 'deleted'
         AND scheduled_at >= $1
         AND scheduled_at < $2
       ORDER BY scheduled_at ASC`,
      [weekStart, weekEnd]
    );

    // Group by date
    const grouped: Record<string, unknown[]> = {};
    for (const row of res.rows) {
      const r = row as { scheduled_at: string };
      const date = new Date(r.scheduled_at).toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(row);
    }

    return Response.json({ week_start: weekStart, week_end: weekEnd, by_date: grouped });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
