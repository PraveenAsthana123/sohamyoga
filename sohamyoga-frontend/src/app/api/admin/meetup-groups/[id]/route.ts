import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Ctx): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [groupRes, eventsRes, membersRes, rsvpRes] = await Promise.all([
      client.query(`
        SELECT g.*,
          (SELECT COUNT(*) FROM meetup_member m WHERE m.group_id = g.id AND m.status='active') AS member_count_live
        FROM meetup_group g WHERE g.id = $1
      `, [id]),
      client.query(`
        SELECT e.*,
          (SELECT COUNT(*) FROM meetup_rsvp r WHERE r.event_id = e.id AND r.status='going') AS rsvp_count
        FROM meetup_event e
        WHERE e.group_id = $1 AND e.start_time > NOW() AND e.status != 'cancelled'
        ORDER BY e.start_time ASC LIMIT 5
      `, [id]),
      client.query(`SELECT COUNT(*) AS total, role, COUNT(*) OVER() AS total_all FROM meetup_member WHERE group_id=$1 AND status='active' GROUP BY role`, [id]),
      client.query(`
        SELECT r.*, e.title AS event_title FROM meetup_rsvp r
        JOIN meetup_event e ON e.id = r.event_id
        WHERE r.group_id = $1 ORDER BY r.rsvp_at DESC LIMIT 20
      `, [id]),
    ]);

    if (!groupRes.rowCount) return Response.json({ error: 'Group not found.' }, { status: 404 });

    return Response.json({
      group: groupRes.rows[0],
      upcoming_events: eventsRes.rows,
      member_roles: membersRes.rows,
      recent_rsvps: rsvpRes.rows,
    });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: Ctx): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const allowed = ['name','category','subcategory','description','city','province',
    'meeting_frequency','typical_venue','max_members','organizer_name','organizer_email',
    'meetup_url','facebook_group_url','linkedin_group_url','discord_invite_url',
    'whatsapp_group_url','eventbrite_organizer_url','is_free','membership_fee','status','tags'];

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in body) { sets.push(`${key}=$${idx++}`); vals.push(body[key]); }
  }
  if (!sets.length) return Response.json({ error: 'No fields to update.' }, { status: 400 });
  vals.push(id);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE meetup_group SET ${sets.join(',')} WHERE id=$${idx} RETURNING *`, vals
    );
    if (!res.rowCount) return Response.json({ error: 'Group not found.' }, { status: 404 });
    return Response.json({ group: res.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(`UPDATE meetup_group SET status='archived' WHERE id=$1 RETURNING id`, [id]);
    if (!res.rowCount) return Response.json({ error: 'Group not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
