export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [venues, attendeeStats, gamStats] = await Promise.all([
      client.query('SELECT * FROM event_venues'),
      client.query(`SELECT event_name, COUNT(*) as registered, COUNT(*) FILTER (WHERE checked_in) as checked_in,
        ROUND(AVG(lead_score),1) as avg_lead_score FROM event_attendees GROUP BY event_name`),
      client.query('SELECT event_name, SUM(completions) as total_completions, SUM(points*completions) as total_points FROM event_gamification GROUP BY event_name'),
    ]);
    const report = venues.rows.map(v => {
      const a = attendeeStats.rows.find(r => r.event_name === v.event_name) || { registered: 0, checked_in: 0, avg_lead_score: 0 };
      const g = gamStats.rows.find(r => r.event_name === v.event_name) || { total_completions: 0, total_points: 0 };
      return {
        ...v,
        registered: Number(a.registered),
        checked_in: Number(a.checked_in),
        capacity_used_pct: v.capacity ? Math.round((Number(a.registered) / v.capacity) * 100) : 0,
        check_in_rate_pct: Number(a.registered) ? Math.round((Number(a.checked_in) / Number(a.registered)) * 100) : 0,
        avg_lead_score: Number(a.avg_lead_score),
        gamification_completions: Number(g.total_completions),
        gamification_points_earned: Number(g.total_points),
      };
    });
    return Response.json(report);
  } finally { client.release(); }
}
