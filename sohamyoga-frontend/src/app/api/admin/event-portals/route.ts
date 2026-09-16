import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_portal_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      portal TEXT NOT NULL,
      portal_name TEXT,
      status TEXT DEFAULT 'disconnected',
      api_key_set BOOLEAN DEFAULT false,
      org_id TEXT,
      org_name TEXT,
      profile_url TEXT,
      last_sync_at TIMESTAMPTZ,
      events_synced INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS external_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      portal TEXT NOT NULL,
      external_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      event_type TEXT DEFAULT 'networking',
      format TEXT DEFAULT 'online',
      status TEXT DEFAULT 'published',
      start_at TIMESTAMPTZ,
      end_at TIMESTAMPTZ,
      timezone TEXT DEFAULT 'America/Toronto',
      location_name TEXT,
      location_address TEXT,
      meeting_url TEXT,
      capacity INT,
      rsvp_count INT DEFAULT 0,
      waitlist_count INT DEFAULT 0,
      attendees_count INT DEFAULT 0,
      ticket_price NUMERIC(10,2) DEFAULT 0,
      is_free BOOLEAN DEFAULT true,
      image_url TEXT,
      tags TEXT[],
      portal_url TEXT,
      synced_from_portal BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS event_attendees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID REFERENCES external_events(id) ON DELETE CASCADE,
      portal TEXT,
      name TEXT,
      email TEXT,
      phone TEXT,
      rsvp_status TEXT DEFAULT 'going',
      ticket_type TEXT,
      registered_at TIMESTAMPTZ DEFAULT NOW(),
      checked_in_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS event_portal_stats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      portal TEXT NOT NULL,
      total_events INT DEFAULT 0,
      total_rsvps INT DEFAULT 0,
      total_attendees INT DEFAULT 0,
      avg_attendance_rate NUMERIC(5,4),
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Seed portal connections if none exist
  const existing = await pool.query(`SELECT COUNT(*) AS cnt FROM event_portal_connections`);
  if (Number(existing.rows[0].cnt) === 0) {
    await pool.query(`
      INSERT INTO event_portal_connections (portal, portal_name, status, api_key_set) VALUES
        ('meetup', 'Meetup.com', 'disconnected', false),
        ('eventbrite', 'Eventbrite', 'demo', false),
        ('luma', 'Luma', 'demo', false),
        ('google_meet', 'Google Meet', 'connected', false),
        ('linkedin_events', 'LinkedIn Events', 'disconnected', false),
        ('zoom', 'Zoom', 'demo', false),
        ('facebook_events', 'Facebook Events', 'demo', false),
        ('humanitix', 'Humanitix', 'disconnected', false),
        ('ticketmaster', 'Ticketmaster', 'disconnected', false)
      ON CONFLICT DO NOTHING
    `);
  }

  // Seed external events if none exist
  const evtsExisting = await pool.query(`SELECT COUNT(*) AS cnt FROM external_events`);
  if (Number(evtsExisting.rows[0].cnt) === 0) {
    await pool.query(`
      INSERT INTO external_events (portal, title, description, event_type, format, status, start_at, end_at, capacity, rsvp_count, is_free, ticket_price, tags) VALUES
        ('eventbrite','Yoga & Wellness Summit 2026','Annual wellness summit featuring top yoga instructors.','conference','in_person','published',NOW()+INTERVAL '10 days',NOW()+INTERVAL '10 days 8 hours',200,142,false,49.00,ARRAY['yoga','wellness','conference']),
        ('eventbrite','Beginner Yoga Workshop','Perfect introduction to yoga for absolute beginners.','workshop','in_person','published',NOW()+INTERVAL '3 days',NOW()+INTERVAL '3 days 2 hours',30,24,false,25.00,ARRAY['yoga','beginner','workshop']),
        ('luma','Online Meditation Circle','Weekly guided meditation session via Zoom.','networking','online','published',NOW()+INTERVAL '2 days',NOW()+INTERVAL '2 days 1 hour',100,67,true,0,ARRAY['meditation','online','weekly']),
        ('luma','Breathwork & Pranayama Masterclass','Deep dive into pranayama breathing techniques.','webinar','online','published',NOW()+INTERVAL '7 days',NOW()+INTERVAL '7 days 2 hours',150,89,false,15.00,ARRAY['breathwork','pranayama','masterclass']),
        ('google_meet','Team Sync: Marketing Q4 Planning','Internal team meeting for Q4 campaign planning.','networking','online','published',NOW()+INTERVAL '1 day',NOW()+INTERVAL '1 day 1 hour',20,12,true,0,ARRAY['internal','planning']),
        ('google_meet','Partner Onboarding Call','Welcome call for new studio partners.','networking','online','published',NOW()+INTERVAL '4 days',NOW()+INTERVAL '4 days 1 hour',10,5,true,0,ARRAY['partner','onboarding']),
        ('zoom','Ashtanga Fundamentals Webinar','Learn the primary series of Ashtanga yoga online.','webinar','online','published',NOW()+INTERVAL '5 days',NOW()+INTERVAL '5 days 2 hours',200,134,false,20.00,ARRAY['ashtanga','webinar','fundamentals']),
        ('zoom','Yin Yoga Deep Dive','90-minute yin yoga session for flexibility and recovery.','webinar','online','published',NOW()+INTERVAL '6 days',NOW()+INTERVAL '6 days 2 hours',75,55,false,12.00,ARRAY['yin','recovery','flexibility']),
        ('facebook_events','Community Yoga in the Park','Free outdoor yoga session open to the community.','social','in_person','published',NOW()+INTERVAL '8 days',NOW()+INTERVAL '8 days 2 hours',NULL,203,true,0,ARRAY['outdoor','community','free']),
        ('facebook_events','Diwali Yoga Celebration','Special yoga and cultural celebration event.','social','in_person','published',NOW()+INTERVAL '14 days',NOW()+INTERVAL '14 days 3 hours',150,98,false,10.00,ARRAY['diwali','cultural','celebration']),
        ('meetup','Toronto Yoga Meetup - Monthly Gathering','Monthly networking for Toronto yoga enthusiasts.','meetup','in_person','published',NOW()+INTERVAL '12 days',NOW()+INTERVAL '12 days 2 hours',50,38,true,0,ARRAY['toronto','meetup','networking']),
        ('meetup','Yoga Instructors Hackathon','Build innovative yoga tech tools in 24 hours.','hackathon','in_person','published',NOW()+INTERVAL '20 days',NOW()+INTERVAL '21 days',40,22,false,30.00,ARRAY['hackathon','tech','instructors'])
    `);

    // Seed attendees
    const evts = await pool.query(`SELECT id, portal FROM external_events LIMIT 5`);
    for (const evt of evts.rows) {
      await pool.query(`
        INSERT INTO event_attendees (event_id, portal, name, email, rsvp_status, ticket_type) VALUES
          ($1, $2, 'Anika Sharma', 'anika.sharma@example.com', 'going', 'General'),
          ($1, $2, 'Raj Patel', 'raj.patel@example.com', 'going', 'General'),
          ($1, $2, 'Meera Nair', 'meera.nair@example.com', 'going', 'VIP'),
          ($1, $2, 'David Chen', 'david.chen@example.com', 'waitlist', 'General')
      `, [evt.id, evt.portal]);
    }

    // Seed portal stats
    await pool.query(`
      INSERT INTO event_portal_stats (portal, total_events, total_rsvps, total_attendees, avg_attendance_rate) VALUES
        ('meetup', 24, 892, 741, 0.8307),
        ('eventbrite', 18, 1243, 1089, 0.8763),
        ('luma', 31, 2156, 1876, 0.8701),
        ('google_meet', 67, 456, 421, 0.9232),
        ('zoom', 42, 3210, 2876, 0.8960),
        ('facebook_events', 15, 678, 543, 0.8009),
        ('linkedin_events', 8, 234, 198, 0.8461),
        ('humanitix', 5, 145, 121, 0.8345),
        ('ticketmaster', 2, 890, 812, 0.9124)
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const [portals, stats, upcoming] = await Promise.all([
      pool.query(`SELECT * FROM event_portal_connections ORDER BY portal`),
      pool.query(`SELECT * FROM event_portal_stats ORDER BY portal`),
      pool.query(`SELECT portal, COUNT(*) AS cnt FROM external_events WHERE start_at > NOW() AND status='published' GROUP BY portal`),
    ]);
    const summary = await pool.query(`
      SELECT
        COUNT(*) AS total_events,
        COUNT(*) FILTER (WHERE start_at > NOW() AND status='published') AS upcoming,
        SUM(rsvp_count) AS total_rsvps,
        ROUND(AVG(CASE WHEN rsvp_count > 0 AND capacity > 0 THEN attendees_count::numeric/capacity ELSE NULL END),4) AS avg_attendance_rate
      FROM external_events
    `);
    const upcomingMap: Record<string, number> = {};
    for (const r of upcoming.rows) upcomingMap[r.portal] = Number(r.cnt);
    return Response.json({
      portals: portals.rows,
      stats: stats.rows,
      upcomingByPortal: upcomingMap,
      summary: summary.rows[0],
    });
  } catch (err) {
    console.error('[event-portals GET]', err);
    return Response.json({ error: 'Failed to load portal connections.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

    const validPortals = ['meetup','eventbrite','luma','google_meet','linkedin_events','zoom','facebook_events','humanitix','ticketmaster'];
    const { portal, portal_name, status, api_key_set, org_id, org_name, profile_url } = body as Record<string, unknown>;

    if (!portal || !validPortals.includes(portal as string)) {
      return Response.json({ error: 'Valid portal is required.' }, { status: 400 });
    }
    const result = await pool.query(`
      INSERT INTO event_portal_connections (portal, portal_name, status, api_key_set, org_id, org_name, profile_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (portal) DO UPDATE SET
        portal_name = COALESCE($2, event_portal_connections.portal_name),
        status = COALESCE($3, event_portal_connections.status),
        api_key_set = COALESCE($4, event_portal_connections.api_key_set),
        org_id = COALESCE($5, event_portal_connections.org_id),
        org_name = COALESCE($6, event_portal_connections.org_name),
        profile_url = COALESCE($7, event_portal_connections.profile_url)
      RETURNING *
    `, [portal, portal_name ?? null, status ?? 'disconnected', api_key_set ?? false, org_id ?? null, org_name ?? null, profile_url ?? null]);

    return Response.json({ ok: true, portal: result.rows[0] });
  } catch (err) {
    console.error('[event-portals POST]', err);
    return Response.json({ error: 'Failed to save portal connection.' }, { status: 500 });
  }
}
