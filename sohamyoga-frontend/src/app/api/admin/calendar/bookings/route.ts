import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns Cal.com calendar state. When CALCOM_API_KEY is absent, returns
// configured=false with an honest reason — never fake data.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;

  const configured = !!(process.env.CALCOM_API_KEY && process.env.CALCOM_EVENT_TYPE_ID);

  if (!configured) {
    return Response.json({
      configured: false,
      reason: 'Set CALCOM_API_KEY and CALCOM_EVENT_TYPE_ID to enable live booking sync.',
      todayCount: 0,
      weekCount: 0,
      bookings: [],
      avgValueGbp: null,
      cancellationRate: null,
      utilizationPct: null,
    });
  }

  // Credentials present — fetch from local cal_booking table (populated by CalendarSyncJob).
  if (!databaseConfigured()) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  try {
    const rows = await query(
      `SELECT id,
              COALESCE(customer_name, 'Unknown') AS "customerName",
              COALESCE(service_name, 'Appointment') AS service,
              start_time AS "startTime",
              status,
              created_at AS "bookedAt",
              COALESCE(duration_minutes, 60) AS "durationMinutes"
       FROM cal_booking
       ORDER BY start_time DESC
       LIMIT 200`,
    );

    const bookings = rows.rows as Array<{
      id: string; customerName: string; service: string;
      startTime: string; status: string; bookedAt: string; durationMinutes: number;
    }>;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today.getTime() + 7 * 86400_000);

    const todayCount = bookings.filter(b => {
      const d = new Date(b.startTime);
      return d >= today && d < new Date(today.getTime() + 86400_000);
    }).length;

    const weekCount = bookings.filter(b => {
      const d = new Date(b.startTime);
      return d >= today && d < weekEnd;
    }).length;

    const cancelled = bookings.filter(b => b.status === 'cancelled').length;
    const cancellationRate = bookings.length ? Math.round((cancelled / bookings.length) * 100) : null;

    return Response.json({
      configured: true,
      todayCount,
      weekCount,
      bookings,
      avgValueGbp: null, // Requires price data from cal_booking.price_gbp — add when available
      cancellationRate,
      utilizationPct: null, // Requires working-hours config to compute
    });
  } catch {
    // cal_booking table doesn't exist yet — CalendarSyncJob hasn't run
    return Response.json({
      configured: true,
      todayCount: 0,
      weekCount: 0,
      bookings: [],
      avgValueGbp: null,
      cancellationRate: null,
      utilizationPct: null,
    });
  }
}
