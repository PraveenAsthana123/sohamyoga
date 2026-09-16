import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
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

    if (!params.id || !/^[0-9a-f-]{36}$/i.test(params.id)) {
      return Response.json({ error: 'Invalid event ID.' }, { status: 400 });
    }
    const result = await pool.query(`SELECT * FROM external_events WHERE id=$1`, [params.id]);
    if (!result.rowCount) return Response.json({ error: 'Event not found.' }, { status: 404 });
    return Response.json({ event: result.rows[0] });
  } catch (err) {
    console.error('[event-portals events/:id GET]', err);
    return Response.json({ error: 'Failed to load event.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    if (!params.id || !/^[0-9a-f-]{36}$/i.test(params.id)) {
      return Response.json({ error: 'Invalid event ID.' }, { status: 400 });
    }
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

    const allowed = ['title','description','event_type','format','status','start_at','end_at','timezone',
      'location_name','location_address','meeting_url','capacity','rsvp_count','waitlist_count',
      'attendees_count','ticket_price','is_free','image_url','tags','portal_url'];
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(body)) {
      if (allowed.includes(key)) {
        setClauses.push(`${key}=$${idx++}`);
        values.push(val);
      }
    }
    if (setClauses.length === 0) return Response.json({ error: 'No valid fields to update.' }, { status: 400 });

    setClauses.push(`updated_at=NOW()`);
    values.push(params.id);
    const result = await pool.query(
      `UPDATE external_events SET ${setClauses.join(',')} WHERE id=$${idx} RETURNING *`,
      values
    );
    if (!result.rowCount) return Response.json({ error: 'Event not found.' }, { status: 404 });
    return Response.json({ ok: true, event: result.rows[0] });
  } catch (err) {
    console.error('[event-portals events/:id PATCH]', err);
    return Response.json({ error: 'Failed to update event.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    if (!params.id || !/^[0-9a-f-]{36}$/i.test(params.id)) {
      return Response.json({ error: 'Invalid event ID.' }, { status: 400 });
    }
    const result = await pool.query(`DELETE FROM external_events WHERE id=$1 RETURNING id`, [params.id]);
    if (!result.rowCount) return Response.json({ error: 'Event not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[event-portals events/:id DELETE]', err);
    return Response.json({ error: 'Failed to delete event.' }, { status: 500 });
  }
}
