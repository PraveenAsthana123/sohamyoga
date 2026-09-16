import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({})) as Record<string,unknown>;
    const { title, description, start_at, end_at, timezone = 'America/Toronto' } = body;

    if (!process.env.GOOGLE_CALENDAR_TOKEN) {
      return Response.json({
        meeting_url: 'https://meet.google.com/new',
        warning: 'Connect Google Calendar to auto-create Meet links. Set GOOGLE_CALENDAR_TOKEN in your environment.',
        manual: true,
      });
    }

    const requestId = `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GOOGLE_CALENDAR_TOKEN}`,
      },
      body: JSON.stringify({
        summary: title ?? 'New Meeting',
        description: description ?? '',
        start: { dateTime: start_at ?? new Date().toISOString(), timeZone: timezone },
        end: { dateTime: end_at ?? new Date(Date.now() + 3600000).toISOString(), timeZone: timezone },
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return Response.json({
        error: `Google Calendar API error: HTTP ${r.status}`,
        detail: errText,
        meeting_url: 'https://meet.google.com/new',
        warning: 'Auto-creation failed — use manual link.',
      }, { status: 502 });
    }

    const data = await r.json() as { hangoutLink?: string; htmlLink?: string; id?: string };
    return Response.json({
      meeting_url: data.hangoutLink ?? 'https://meet.google.com/new',
      calendar_event_url: data.htmlLink,
      calendar_event_id: data.id,
      ok: true,
    });
  } catch (err) {
    console.error('[google-meet POST]', err);
    return Response.json({
      meeting_url: 'https://meet.google.com/new',
      warning: 'Failed to connect to Google Calendar. Use the manual link.',
      error: String(err),
    }, { status: 502 });
  }
}
