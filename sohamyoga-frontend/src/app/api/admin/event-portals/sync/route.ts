import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO_EVENTS: Record<string, Array<{title: string; description: string; event_type: string; format: string; start_offset_days: number; rsvp_count: number; is_free: boolean; ticket_price: number}>> = {
  meetup: [
    { title: 'Toronto Yoga & Mindfulness Meetup', description: 'Monthly yoga and mindfulness gathering for the Toronto community.', event_type: 'meetup', format: 'in_person', start_offset_days: 15, rsvp_count: 47, is_free: true, ticket_price: 0 },
    { title: 'Yoga Teachers Circle — Autumn Edition', description: 'Peer learning session for yoga instructors.', event_type: 'networking', format: 'in_person', start_offset_days: 22, rsvp_count: 18, is_free: true, ticket_price: 0 },
    { title: 'Partner Yoga Workshop', description: 'Fun and accessible partner yoga for all skill levels.', event_type: 'workshop', format: 'in_person', start_offset_days: 30, rsvp_count: 24, is_free: false, ticket_price: 15 },
  ],
  eventbrite: [
    { title: 'Yoga for Stress Relief — Full Day Retreat', description: 'A full day immersive yoga retreat focused on stress reduction.', event_type: 'workshop', format: 'in_person', start_offset_days: 8, rsvp_count: 68, is_free: false, ticket_price: 95 },
    { title: 'Intro to Iyengar Yoga', description: 'Beginner-friendly introduction to Iyengar yoga methodology.', event_type: 'workshop', format: 'in_person', start_offset_days: 11, rsvp_count: 32, is_free: false, ticket_price: 35 },
    { title: 'Corporate Wellness Yoga Series', description: 'Six-week yoga program designed for busy professionals.', event_type: 'conference', format: 'hybrid', start_offset_days: 18, rsvp_count: 55, is_free: false, ticket_price: 120 },
  ],
  luma: [
    { title: 'Daily Morning Yoga Flow — Live', description: 'Start your day right with a 45-minute morning yoga flow.', event_type: 'webinar', format: 'online', start_offset_days: 1, rsvp_count: 234, is_free: true, ticket_price: 0 },
    { title: 'Restorative Yoga & Yoga Nidra', description: 'Deep rest and recovery through restorative yoga and yoga nidra.', event_type: 'webinar', format: 'online', start_offset_days: 4, rsvp_count: 189, is_free: false, ticket_price: 12 },
    { title: 'Kids Yoga Fun — Parent & Child', description: 'Interactive yoga session designed for parents and their young children.', event_type: 'workshop', format: 'online', start_offset_days: 9, rsvp_count: 76, is_free: false, ticket_price: 20 },
  ],
  zoom: [
    { title: 'Power Yoga Bootcamp', description: 'High-intensity yoga session for strength and endurance.', event_type: 'webinar', format: 'online', start_offset_days: 3, rsvp_count: 145, is_free: false, ticket_price: 18 },
    { title: 'Prenatal Yoga Series — Session 1', description: 'Safe and supportive yoga for expecting mothers.', event_type: 'webinar', format: 'online', start_offset_days: 6, rsvp_count: 42, is_free: false, ticket_price: 25 },
    { title: 'Advanced Inversions Workshop', description: 'Headstand, handstand, and shoulder stand deep dive.', event_type: 'workshop', format: 'online', start_offset_days: 13, rsvp_count: 38, is_free: false, ticket_price: 30 },
  ],
  facebook_events: [
    { title: 'Sunrise Beach Yoga', description: 'Outdoor yoga at sunrise on the waterfront.', event_type: 'social', format: 'in_person', start_offset_days: 5, rsvp_count: 312, is_free: true, ticket_price: 0 },
    { title: 'Yoga & Brunch Social', description: 'Morning yoga class followed by a healthy brunch spread.', event_type: 'social', format: 'in_person', start_offset_days: 16, rsvp_count: 87, is_free: false, ticket_price: 35 },
    { title: 'Full Moon Yoga Night', description: 'Special yoga session held under the full moon.', event_type: 'social', format: 'in_person', start_offset_days: 25, rsvp_count: 156, is_free: true, ticket_price: 0 },
  ],
};

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const body = await req.json().catch(() => ({})) as { portal?: string };
    const targetPortal = body.portal ?? null;

    const portalsResult = await pool.query(
      targetPortal
        ? `SELECT * FROM event_portal_connections WHERE portal=$1`
        : `SELECT * FROM event_portal_connections`,
      targetPortal ? [targetPortal] : []
    );
    const portals = portalsResult.rows;

    const results: Array<{portal: string; synced: number; demo: boolean; warning?: string; error?: string}> = [];

    for (const conn of portals) {
      if (conn.status === 'disconnected') {
        results.push({ portal: conn.portal, synced: 0, demo: false, warning: 'Portal not connected.' });
        continue;
      }

      // Real API sync
      if (conn.api_key_set) {
        try {
          let fetchedCount = 0;
          if (conn.portal === 'meetup' && process.env.MEETUP_API_KEY) {
            const r = await fetch(`https://api.meetup.com/self/events?status=upcoming&key=${process.env.MEETUP_API_KEY}`, { signal: AbortSignal.timeout(8000) });
            if (r.ok) {
              const data = await r.json() as Array<Record<string, unknown>>;
              for (const ev of data) {
                await pool.query(`
                  INSERT INTO external_events (portal, external_id, title, description, event_type, format, start_at, end_at, rsvp_count, is_free, portal_url, synced_from_portal)
                  VALUES ('meetup',$1,$2,$3,'meetup','in_person',$4,$5,$6,true,$7,true)
                  ON CONFLICT (portal, external_id) DO UPDATE SET title=$2, rsvp_count=$6, updated_at=NOW()
                `, [ev.id, ev.name, ev.description, ev.time ? new Date(Number(ev.time)) : null, ev.duration ? new Date(Number(ev.time) + Number(ev.duration)) : null, ev.yes_rsvp_count ?? 0, ev.link ?? null]);
                fetchedCount++;
              }
            }
          } else if (conn.portal === 'eventbrite' && process.env.EVENTBRITE_TOKEN && conn.org_id) {
            const r = await fetch(`https://www.eventbriteapi.com/v3/organizations/${conn.org_id}/events/?token=${process.env.EVENTBRITE_TOKEN}`, { signal: AbortSignal.timeout(8000) });
            if (r.ok) {
              const data = await r.json() as { events: Array<Record<string, unknown>> };
              for (const ev of (data.events ?? [])) {
                const startObj = ev.start as Record<string,string>|null;
                const endObj = ev.end as Record<string,string>|null;
                await pool.query(`
                  INSERT INTO external_events (portal, external_id, title, description, format, start_at, end_at, is_free, synced_from_portal)
                  VALUES ('eventbrite',$1,$2,$3,'in_person',$4,$5,$6,true)
                  ON CONFLICT (portal, external_id) DO UPDATE SET title=$2, updated_at=NOW()
                `, [ev.id, ev.name, ev.description, startObj?.utc ?? null, endObj?.utc ?? null, ev.is_free ?? true]);
                fetchedCount++;
              }
            }
          } else if (conn.portal === 'luma' && process.env.LUMA_API_KEY && process.env.LUMA_CALENDAR_ID) {
            const r = await fetch(`https://api.lu.ma/public/v1/calendar/list-events?calendar_api_id=${process.env.LUMA_CALENDAR_ID}`, {
              headers: { 'x-luma-api-key': process.env.LUMA_API_KEY },
              signal: AbortSignal.timeout(8000),
            });
            if (r.ok) {
              const data = await r.json() as { entries: Array<{ event: Record<string,unknown> }> };
              for (const entry of (data.entries ?? [])) {
                const ev = entry.event;
                await pool.query(`
                  INSERT INTO external_events (portal, external_id, title, description, format, start_at, end_at, is_free, synced_from_portal)
                  VALUES ('luma',$1,$2,$3,'online',$4,$5,true,true)
                  ON CONFLICT (portal, external_id) DO UPDATE SET title=$2, updated_at=NOW()
                `, [ev.api_id, ev.name, ev.description, ev.start_at ?? null, ev.end_at ?? null]);
                fetchedCount++;
              }
            }
          }
          await pool.query(`UPDATE event_portal_connections SET last_sync_at=NOW(), events_synced=events_synced+$2 WHERE portal=$1`, [conn.portal, fetchedCount]);
          results.push({ portal: conn.portal, synced: fetchedCount, demo: false });
          continue;
        } catch (syncErr) {
          console.error(`[event-portals sync] ${conn.portal}`, syncErr);
        }
      }

      // Demo fallback
      const demoList = DEMO_EVENTS[conn.portal] ?? [];
      let demoCount = 0;
      for (const ev of demoList) {
        const startAt = new Date(Date.now() + ev.start_offset_days * 86400000);
        const endAt = new Date(startAt.getTime() + 7200000);
        await pool.query(`
          INSERT INTO external_events (portal, title, description, event_type, format, start_at, end_at, rsvp_count, is_free, ticket_price, synced_from_portal)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false)
          ON CONFLICT DO NOTHING
        `, [conn.portal, ev.title, ev.description, ev.event_type, ev.format, startAt, endAt, ev.rsvp_count, ev.is_free, ev.ticket_price]);
        demoCount++;
      }
      await pool.query(`UPDATE event_portal_connections SET last_sync_at=NOW(), events_synced=events_synced+$2 WHERE portal=$1`, [conn.portal, demoCount]);
      results.push({ portal: conn.portal, synced: demoCount, demo: true, warning: 'No API key configured — demo events imported.' });
    }

    return Response.json({ ok: true, results });
  } catch (err) {
    console.error('[event-portals sync]', err);
    return Response.json({ error: 'Sync failed.' }, { status: 500 });
  }
}
