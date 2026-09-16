import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const pool = getPool();
    const result = await pool.query('SELECT * FROM webinars WHERE id = $1', [params.id]);
    if (result.rows.length === 0) return Response.json({ error: 'Webinar not found' }, { status: 404 });
    return Response.json(result.rows[0]);
  } catch (err) {
    console.error('[webinars/:id GET]', err);
    return Response.json({ error: 'Failed to fetch webinar' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const pool = getPool();
    const body = await req.json() as Record<string, unknown>;

    const allowed = ['title', 'description', 'host_name', 'co_hosts', 'platform', 'meeting_url',
      'scheduled_at', 'duration_minutes', 'capacity', 'registration_count', 'attendees_count',
      'recording_url', 'agenda_json', 'status', 'follow_up_sent'];

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = $${idx++}`);
        const val = body[key];
        values.push(key === 'agenda_json' ? JSON.stringify(val) : val);
      }
    }

    if (sets.length === 0) return Response.json({ error: 'No valid fields to update' }, { status: 400 });

    values.push(params.id);
    const result = await pool.query(
      `UPDATE webinars SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return Response.json({ error: 'Webinar not found' }, { status: 404 });
    return Response.json(result.rows[0]);
  } catch (err) {
    console.error('[webinars/:id PATCH]', err);
    return Response.json({ error: 'Failed to update webinar' }, { status: 500 });
  }
}
