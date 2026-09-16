import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANUAL_LINKS = {
  meetup: 'https://www.meetup.com/create-event',
  eventbrite: 'https://www.eventbrite.com/create',
  luma: 'https://lu.ma/events/new',
  zoom: 'https://zoom.us/meeting/schedule',
  google_meet: 'https://calendar.google.com/calendar/r/eventedit',
  linkedin_events: 'https://www.linkedin.com/events/new/',
  facebook_events: 'https://www.facebook.com/events/create/',
  humanitix: 'https://events.humanitix.com/create',
  ticketmaster: 'https://help.ticketmaster.com/s/article/How-do-I-create-an-event',
};

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    await pool.query(`CREATE TABLE IF NOT EXISTS external_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      portal TEXT NOT NULL, external_id TEXT, title TEXT NOT NULL,
      description TEXT, event_type TEXT DEFAULT 'networking', format TEXT DEFAULT 'online',
      status TEXT DEFAULT 'published', start_at TIMESTAMPTZ, end_at TIMESTAMPTZ,
      timezone TEXT DEFAULT 'America/Toronto', location_name TEXT, location_address TEXT,
      meeting_url TEXT, capacity INT, rsvp_count INT DEFAULT 0, waitlist_count INT DEFAULT 0,
      attendees_count INT DEFAULT 0, ticket_price NUMERIC(10,2) DEFAULT 0, is_free BOOLEAN DEFAULT true,
      image_url TEXT, tags TEXT[], portal_url TEXT, synced_from_portal BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    const url = new URL(req.url);
    const portal = url.searchParams.get('portal');
    const status = url.searchParams.get('status');
    const format = url.searchParams.get('format');
    const upcoming = url.searchParams.get('upcoming');
    const eventType = url.searchParams.get('type');

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (portal) { conditions.push(`portal=$${idx++}`); values.push(portal); }
    if (status) { conditions.push(`status=$${idx++}`); values.push(status); }
    if (format) { conditions.push(`format=$${idx++}`); values.push(format); }
    if (eventType) { conditions.push(`event_type=$${idx++}`); values.push(eventType); }
    if (upcoming === 'true') { conditions.push(`start_at > NOW() AND status='published'`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(`SELECT * FROM external_events ${where} ORDER BY start_at ASC NULLS LAST LIMIT 200`, values);
    return Response.json({ events: result.rows });
  } catch (err) {
    console.error('[event-portals events GET]', err);
    return Response.json({ error: 'Failed to load events.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    await pool.query(`CREATE TABLE IF NOT EXISTS external_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      portal TEXT NOT NULL, external_id TEXT, title TEXT NOT NULL,
      description TEXT, event_type TEXT DEFAULT 'networking', format TEXT DEFAULT 'online',
      status TEXT DEFAULT 'published', start_at TIMESTAMPTZ, end_at TIMESTAMPTZ,
      timezone TEXT DEFAULT 'America/Toronto', location_name TEXT, location_address TEXT,
      meeting_url TEXT, capacity INT, rsvp_count INT DEFAULT 0, waitlist_count INT DEFAULT 0,
      attendees_count INT DEFAULT 0, ticket_price NUMERIC(10,2) DEFAULT 0, is_free BOOLEAN DEFAULT true,
      image_url TEXT, tags TEXT[], portal_url TEXT, synced_from_portal BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    const body = await req.json().catch(() => null) as Record<string,unknown> | null;
    if (!body || !body.title) return Response.json({ error: 'title is required.' }, { status: 400 });

    const {
      portal = 'google_meet', title, description, event_type = 'networking', format = 'online',
      start_at, end_at, timezone = 'America/Toronto', location_name, location_address,
      meeting_url, capacity, ticket_price = 0, is_free = true, image_url, tags = [], publish_portals = []
    } = body as Record<string,unknown>;

    // Save locally
    const result = await pool.query(`
      INSERT INTO external_events (portal, title, description, event_type, format, start_at, end_at, timezone,
        location_name, location_address, meeting_url, capacity, ticket_price, is_free, image_url, tags, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'published')
      RETURNING *
    `, [portal, title, description ?? null, event_type, format, start_at ?? null, end_at ?? null, timezone,
        location_name ?? null, location_address ?? null, meeting_url ?? null, capacity ?? null,
        ticket_price, is_free, image_url ?? null, tags]);

    const savedEvent = result.rows[0];
    const portalPublishResults: Record<string, unknown> = {};
    const warnings: string[] = [];

    // Publish to connected portals
    const portalsToPublish = Array.isArray(publish_portals) ? publish_portals as string[] : [];
    for (const p of portalsToPublish) {
      try {
        if (p === 'meetup' && process.env.MEETUP_API_KEY && process.env.MEETUP_GROUP_URLNAME) {
          const r = await fetch(`https://api.meetup.com/${process.env.MEETUP_GROUP_URLNAME}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.MEETUP_API_KEY}` },
            body: JSON.stringify({ name: title, description, time: start_at ? new Date(start_at as string).getTime() : undefined }),
            signal: AbortSignal.timeout(8000),
          });
          portalPublishResults[p] = r.ok ? { published: true } : { error: `HTTP ${r.status}` };
        } else if (p === 'eventbrite' && process.env.EVENTBRITE_TOKEN) {
          const r = await fetch(`https://www.eventbriteapi.com/v3/events/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.EVENTBRITE_TOKEN}` },
            body: JSON.stringify({ event: { name: { html: title }, description: { html: description ?? '' }, start: { timezone, utc: start_at }, end: { timezone, utc: end_at }, currency: 'CAD' } }),
            signal: AbortSignal.timeout(8000),
          });
          portalPublishResults[p] = r.ok ? { published: true } : { error: `HTTP ${r.status}` };
        } else if (p === 'luma' && process.env.LUMA_API_KEY) {
          const r = await fetch(`https://api.lu.ma/public/v1/event/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-luma-api-key': process.env.LUMA_API_KEY },
            body: JSON.stringify({ name: title, description, start_at, end_at, timezone }),
            signal: AbortSignal.timeout(8000),
          });
          portalPublishResults[p] = r.ok ? { published: true } : { error: `HTTP ${r.status}` };
        } else if (p === 'google_meet' && process.env.GOOGLE_CALENDAR_TOKEN) {
          const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GOOGLE_CALENDAR_TOKEN}` },
            body: JSON.stringify({
              summary: title, description: description ?? '',
              start: { dateTime: start_at, timeZone: timezone },
              end: { dateTime: end_at, timeZone: timezone },
              conferenceData: { createRequest: { requestId: savedEvent.id, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (r.ok) {
            const data = await r.json() as { hangoutLink?: string };
            portalPublishResults[p] = { published: true, meeting_url: data.hangoutLink };
            if (data.hangoutLink) {
              await pool.query(`UPDATE external_events SET meeting_url=$2 WHERE id=$1`, [savedEvent.id, data.hangoutLink]);
            }
          } else {
            portalPublishResults[p] = { error: `HTTP ${r.status}` };
          }
        } else {
          warnings.push(`No API key configured for ${p}.`);
          portalPublishResults[p] = { manual_link: (MANUAL_LINKS as Record<string,string>)[p] ?? null };
        }
      } catch (e) {
        portalPublishResults[p] = { error: String(e) };
      }
    }

    const response: Record<string,unknown> = { ok: true, event: savedEvent, portalResults: portalPublishResults };
    if (warnings.length > 0) {
      response.warnings = warnings;
      response.manual_links = MANUAL_LINKS;
    }
    return Response.json(response, { status: 201 });
  } catch (err) {
    console.error('[event-portals events POST]', err);
    return Response.json({ error: 'Failed to create event.' }, { status: 500 });
  }
}
