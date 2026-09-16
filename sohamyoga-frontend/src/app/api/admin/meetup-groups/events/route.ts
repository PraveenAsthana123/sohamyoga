import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function generateMeetUrl(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * 26)]).join('');
  return `https://meet.google.com/${seg(3)}-${seg(4)}-${seg(3)}`;
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const group_id = searchParams.get('group_id');
  const event_type = searchParams.get('event_type');
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const upcoming = searchParams.get('upcoming') === 'true';

  const conditions: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (group_id) { conditions.push(`e.group_id=$${idx++}`); vals.push(parseInt(group_id, 10)); }
  if (event_type) { conditions.push(`e.event_type=$${idx++}`); vals.push(event_type); }
  if (status) { conditions.push(`e.status=$${idx++}`); vals.push(status); }
  if (category) { conditions.push(`e.category=$${idx++}`); vals.push(category); }
  if (upcoming) { conditions.push(`e.start_time > NOW()`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT e.*,
        g.name AS group_name,
        g.category AS group_category,
        (SELECT COUNT(*) FROM meetup_rsvp r WHERE r.event_id = e.id AND r.status='going') AS rsvp_count
      FROM meetup_event e
      JOIN meetup_group g ON g.id = e.group_id
      ${where}
      ORDER BY e.start_time ASC
      LIMIT 200
    `, vals);
    return Response.json({ events: res.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const {
    group_id, title, description, event_type, category, venue_name, venue_address,
    city, platform, start_time, end_time, timezone, max_attendees, rsvp_deadline,
    waitlist_enabled, is_free, price, eventbrite_url, posted_to, status, notes,
  } = body as Record<string, unknown>;

  if (!group_id || !title || !start_time) {
    return Response.json({ error: 'group_id, title, and start_time are required.' }, { status: 400 });
  }

  // Auto-generate virtual links
  let google_meet_url: string | null = null;
  let zoom_url: string | null = null;
  const type = (event_type as string) || 'in_person';

  if ((type === 'virtual' || type === 'hybrid') && platform === 'google_meet') {
    google_meet_url = generateMeetUrl();
  }
  if ((type === 'virtual' || type === 'hybrid') && platform === 'zoom') {
    zoom_url = 'https://zoom.us/j/[meeting-id-tbd]';
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(`
      INSERT INTO meetup_event
        (group_id, title, description, event_type, category, venue_name, venue_address,
         city, google_meet_url, zoom_url, platform, start_time, end_time, timezone,
         max_attendees, rsvp_deadline, waitlist_enabled, is_free, price,
         eventbrite_url, posted_to, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *
    `, [
      group_id, (title as string).trim(), description ?? null,
      type, category ?? null,
      venue_name ?? null, venue_address ?? null, city ?? 'Calgary',
      google_meet_url, zoom_url,
      platform ?? null,
      start_time, end_time ?? null,
      timezone ?? 'America/Edmonton',
      max_attendees ?? null, rsvp_deadline ?? null,
      waitlist_enabled === true,
      is_free !== false, price ?? null,
      eventbrite_url ?? null,
      Array.isArray(posted_to) ? posted_to : [],
      status ?? 'draft',
      notes ?? null,
    ]);
    return Response.json({ event: res.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
