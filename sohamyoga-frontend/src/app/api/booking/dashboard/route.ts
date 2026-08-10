import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [monthly, today, channels] = await Promise.all([
    query<{ total: string; cancelled: string; no_show: string }>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
              COUNT(*) FILTER (WHERE status = 'no_show') AS no_show
       FROM booking WHERE booked_at >= date_trunc('month', now())`,
    ),
    query<{ confirmed: string; pending: string }>(
      `SELECT COUNT(*) FILTER (WHERE b.status IN ('confirmed','checked_in')) AS confirmed,
              COUNT(*) FILTER (WHERE b.status = 'pending') AS pending
       FROM booking b JOIN class_session cs ON cs.id = b.class_session_id
       WHERE cs.session_date = CURRENT_DATE`,
    ),
    query<{ channel: string; count: string }>(
      `SELECT channel, COUNT(*) AS count FROM booking
       WHERE booked_at >= date_trunc('month', now()) GROUP BY channel`,
    ),
  ]);

  const waitlistConv = await query<{ promoted: string; total: string }>(
    `SELECT COUNT(*) FILTER (WHERE status = 'promoted') AS promoted, COUNT(*) AS total
     FROM waitlist_entry WHERE joined_at >= date_trunc('month', now())`,
  );

  const dailySeries = await query<{ day: string; count: string }>(
    `SELECT date_trunc('day', booked_at)::date AS day, COUNT(*) AS count
     FROM booking WHERE booked_at >= CURRENT_DATE - INTERVAL '13 days'
     GROUP BY 1 ORDER BY 1`,
  );
  const dailyByDate = new Map(dailySeries.rows.map(r => [r.day, Number(r.count)]));
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return dailyByDate.get(d.toISOString().slice(0, 10)) ?? 0;
  });

  const m = monthly.rows[0];
  const t = today.rows[0];
  const w = waitlistConv.rows[0];
  const totalChannel = channels.rows.reduce((s, r) => s + Number(r.count), 0);
  const total = Number(m?.total ?? 0);

  return Response.json({
    kpis: {
      totalBookingsMonth: total,
      confirmedToday: Number(t?.confirmed ?? 0),
      pendingConfirmations: Number(t?.pending ?? 0),
      cancellationsMonth: Number(m?.cancelled ?? 0),
      cancellationRatePct: total ? Math.round((Number(m?.cancelled ?? 0) / total) * 1000) / 10 : 0,
      noShowsMonth: Number(m?.no_show ?? 0),
      noShowRatePct: total ? Math.round((Number(m?.no_show ?? 0) / total) * 1000) / 10 : 0,
      waitlistConversionPct: Number(w?.total ?? 0) ? Math.round((Number(w?.promoted ?? 0) / Number(w?.total ?? 0)) * 100) : 0,
    },
    channelSplit: channels.rows.map(c => ({
      channel: c.channel, pct: totalChannel ? Math.round((Number(c.count) / totalChannel) * 100) : 0,
    })),
    last14Days,
  });
}
