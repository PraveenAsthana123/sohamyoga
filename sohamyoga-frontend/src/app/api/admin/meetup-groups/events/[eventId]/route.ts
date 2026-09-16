import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { eventId: string } };

export async function GET(req: NextRequest, { params }: Ctx): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const eventId = parseInt(params.eventId, 10);
  if (isNaN(eventId)) return Response.json({ error: 'Invalid eventId.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [eventRes, rsvpRes, sourceRes, statusRes] = await Promise.all([
      client.query(`
        SELECT e.*, g.name AS group_name, g.category AS group_category
        FROM meetup_event e JOIN meetup_group g ON g.id = e.group_id
        WHERE e.id = $1
      `, [eventId]),
      client.query(`SELECT * FROM meetup_rsvp WHERE event_id=$1 ORDER BY rsvp_at DESC`, [eventId]),
      client.query(`SELECT source, COUNT(*) AS count FROM meetup_rsvp WHERE event_id=$1 GROUP BY source ORDER BY count DESC`, [eventId]),
      client.query(`SELECT status, COUNT(*) AS count FROM meetup_rsvp WHERE event_id=$1 GROUP BY status ORDER BY count DESC`, [eventId]),
    ]);

    if (!eventRes.rowCount) return Response.json({ error: 'Event not found.' }, { status: 404 });

    return Response.json({
      event: eventRes.rows[0],
      rsvps: rsvpRes.rows,
      by_source: sourceRes.rows,
      by_status: statusRes.rows,
    });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: Ctx): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const eventId = parseInt(params.eventId, 10);
  if (isNaN(eventId)) return Response.json({ error: 'Invalid eventId.' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const { action } = body;

  // Handle special actions
  if (action === 'rsvp') {
    const { name, email, phone, source, dietary_requirements, notes } = body as Record<string, unknown>;
    if (!name || typeof name !== 'string') return Response.json({ error: 'Name required.' }, { status: 400 });

    const pool = getPool();
    const client = await pool.connect();
    try {
      // Get group_id for this event
      const evRes = await client.query(`SELECT group_id, max_attendees FROM meetup_event WHERE id=$1`, [eventId]);
      if (!evRes.rowCount) return Response.json({ error: 'Event not found.' }, { status: 404 });

      const { group_id, max_attendees } = evRes.rows[0];

      // Check capacity
      let rsvpStatus = 'going';
      if (max_attendees) {
        const countRes = await client.query(`SELECT COUNT(*) AS cnt FROM meetup_rsvp WHERE event_id=$1 AND status='going'`, [eventId]);
        if (Number(countRes.rows[0].cnt) >= max_attendees) rsvpStatus = 'waitlist';
      }

      const rsvp = await client.query(`
        INSERT INTO meetup_rsvp (event_id, group_id, name, email, phone, source, status, dietary_requirements, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
      `, [eventId, group_id, name.trim(), email ?? null, phone ?? null,
          source ?? 'direct', rsvpStatus, dietary_requirements ?? null, notes ?? null]);

      return Response.json({ rsvp: rsvp.rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  }

  if (action === 'remind') {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const evRes = await client.query(`
        SELECT e.*, g.name AS group_name FROM meetup_event e
        JOIN meetup_group g ON g.id = e.group_id WHERE e.id=$1
      `, [eventId]);
      if (!evRes.rowCount) return Response.json({ error: 'Event not found.' }, { status: 404 });
      const ev = evRes.rows[0];

      const prompt = `Write a friendly 48-hour reminder message for this community event:
Event: ${ev.title}
Group: ${ev.group_name}
Date: ${new Date(ev.start_time).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
Time: ${new Date(ev.start_time).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', timeZone: ev.timezone })} ${ev.timezone}
Type: ${ev.event_type}
${ev.venue_name ? `Venue: ${ev.venue_name}, ${ev.venue_address || ev.city}` : ''}
${ev.google_meet_url ? `Google Meet: ${ev.google_meet_url}` : ''}
${ev.zoom_url ? `Zoom: ${ev.zoom_url}` : ''}
Description: ${ev.description || 'Community meetup event'}

Write a warm, energetic reminder (150-200 words) encouraging people to attend. Include key logistics.`;

      let content = `Reminder: "${ev.title}" is happening in 48 hours! We can't wait to see you there. Check your RSVP confirmation for full details.`;
      try {
        const ollamaRes = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
          signal: AbortSignal.timeout(30000),
        });
        if (ollamaRes.ok) {
          const data = await ollamaRes.json() as { response?: string };
          if (data.response?.trim()) content = data.response.trim();
        }
      } catch { /* graceful fallback */ }

      return Response.json({ content });
    } finally {
      client.release();
    }
  }

  // Standard field update
  const allowed = ['title','description','event_type','category','venue_name','venue_address',
    'city','google_meet_url','zoom_url','platform','start_time','end_time','timezone',
    'max_attendees','rsvp_deadline','waitlist_enabled','is_free','price','eventbrite_url',
    'posted_to','status','actual_attendees','recording_url','notes'];

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in body) { sets.push(`${key}=$${idx++}`); vals.push(body[key]); }
  }
  if (!sets.length) return Response.json({ error: 'No fields to update.' }, { status: 400 });
  vals.push(eventId);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE meetup_event SET ${sets.join(',')} WHERE id=$${idx} RETURNING *`, vals
    );
    if (!res.rowCount) return Response.json({ error: 'Event not found.' }, { status: 404 });
    return Response.json({ event: res.rows[0] });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: Ctx): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const eventId = parseInt(params.eventId, 10);
  if (isNaN(eventId)) return Response.json({ error: 'Invalid eventId.' }, { status: 400 });

  // Re-route to PUT handler for rsvp / remind actions
  return PUT(req, { params });
}
