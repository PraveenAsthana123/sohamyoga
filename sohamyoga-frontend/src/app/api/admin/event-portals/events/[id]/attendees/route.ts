import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS event_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID,
    portal TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    rsvp_status TEXT DEFAULT 'going',
    ticket_type TEXT,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    checked_in_at TIMESTAMPTZ
  )`);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTable();
    const pool = getPool();
    if (!params.id || !/^[0-9a-f-]{36}$/i.test(params.id)) {
      return Response.json({ error: 'Invalid event ID.' }, { status: 400 });
    }
    const result = await pool.query(
      `SELECT * FROM event_attendees WHERE event_id=$1 ORDER BY registered_at DESC`,
      [params.id]
    );
    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE rsvp_status='going') AS going,
        COUNT(*) FILTER (WHERE rsvp_status='waitlist') AS waitlist,
        COUNT(*) FILTER (WHERE rsvp_status='not_going') AS not_going,
        COUNT(*) FILTER (WHERE rsvp_status='checked_in') AS checked_in,
        COUNT(*) AS total
      FROM event_attendees WHERE event_id=$1
    `, [params.id]);
    return Response.json({ attendees: result.rows, stats: stats.rows[0] });
  } catch (err) {
    console.error('[event attendees GET]', err);
    return Response.json({ error: 'Failed to load attendees.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTable();
    const pool = getPool();
    if (!params.id || !/^[0-9a-f-]{36}$/i.test(params.id)) {
      return Response.json({ error: 'Invalid event ID.' }, { status: 400 });
    }
    const body = await req.json().catch(() => null) as Record<string,unknown> | null;
    if (!body || !body.name || !body.email) {
      return Response.json({ error: 'name and email are required.' }, { status: 400 });
    }
    // Get portal from event
    const evtResult = await pool.query(`SELECT portal FROM external_events WHERE id=$1`, [params.id]);
    const portal = evtResult.rows[0]?.portal ?? 'manual';

    const result = await pool.query(`
      INSERT INTO event_attendees (event_id, portal, name, email, phone, rsvp_status, ticket_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [params.id, portal, body.name, body.email, body.phone ?? null, body.rsvp_status ?? 'going', body.ticket_type ?? 'General']);

    // Update rsvp count
    await pool.query(`UPDATE external_events SET rsvp_count=rsvp_count+1, updated_at=NOW() WHERE id=$1`, [params.id]);

    return Response.json({ ok: true, attendee: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[event attendees POST]', err);
    return Response.json({ error: 'Failed to add attendee.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTable();
    const pool = getPool();
    const body = await req.json().catch(() => null) as Record<string,unknown> | null;
    if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

    const { attendee_id, action, rsvp_status } = body as { attendee_id?: string; action?: string; rsvp_status?: string };

    // Bulk check-in
    if (action === 'bulk_checkin') {
      await pool.query(`
        UPDATE event_attendees SET rsvp_status='checked_in', checked_in_at=NOW()
        WHERE event_id=$1 AND rsvp_status='going'
      `, [params.id]);
      await pool.query(`UPDATE external_events SET attendees_count=(SELECT COUNT(*) FROM event_attendees WHERE event_id=$1 AND rsvp_status='checked_in'), updated_at=NOW() WHERE id=$1`, [params.id]);
      return Response.json({ ok: true, action: 'bulk_checkin' });
    }

    if (!attendee_id || !/^[0-9a-f-]{36}$/i.test(attendee_id)) {
      return Response.json({ error: 'attendee_id is required for individual updates.' }, { status: 400 });
    }

    if (action === 'checkin') {
      const result = await pool.query(`
        UPDATE event_attendees SET rsvp_status='checked_in', checked_in_at=NOW()
        WHERE id=$1 AND event_id=$2 RETURNING *
      `, [attendee_id, params.id]);
      if (!result.rowCount) return Response.json({ error: 'Attendee not found.' }, { status: 404 });
      await pool.query(`UPDATE external_events SET attendees_count=attendees_count+1, updated_at=NOW() WHERE id=$1`, [params.id]);
      return Response.json({ ok: true, attendee: result.rows[0] });
    }

    if (rsvp_status) {
      const valid = ['going','waitlist','not_going','checked_in'];
      if (!valid.includes(rsvp_status)) return Response.json({ error: 'Invalid rsvp_status.' }, { status: 400 });
      const result = await pool.query(`
        UPDATE event_attendees SET rsvp_status=$2, checked_in_at=CASE WHEN $2='checked_in' THEN NOW() ELSE checked_in_at END
        WHERE id=$1 AND event_id=$3 RETURNING *
      `, [attendee_id, rsvp_status, params.id]);
      if (!result.rowCount) return Response.json({ error: 'Attendee not found.' }, { status: 404 });
      return Response.json({ ok: true, attendee: result.rows[0] });
    }

    return Response.json({ error: 'No valid update action.' }, { status: 400 });
  } catch (err) {
    console.error('[event attendees PATCH]', err);
    return Response.json({ error: 'Failed to update attendee.' }, { status: 500 });
  }
}
