import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getCalendarProviderAdapter } from '@/domain/calendar/getCalendarProviderAdapter';
import { CalendarProviderNotConfiguredError } from '@/domain/calendar/CalendarProviderAdapter';

// GET /api/calendar/availability?from=ISO&to=ISO -- real availability check.
// Fails closed with a clear error (never fabricates open slots) when no
// calendar provider is configured.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  if (!from || !to) return NextResponse.json({ error: 'from and to (ISO 8601) query params are required.' }, { status: 400 });

  try {
    const slots = await getCalendarProviderAdapter().checkAvailability({ fromISO: from, toISO: to });
    return NextResponse.json({ slots });
  } catch (err) {
    const notConfigured = err instanceof CalendarProviderNotConfiguredError;
    const message = err instanceof Error ? err.message : 'Could not check availability.';
    return NextResponse.json({ error: message }, { status: notConfigured ? 409 : 502 });
  }
}
