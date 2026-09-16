import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Ctx): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const groupId = parseInt(params.id, 10);
  if (isNaN(groupId)) return Response.json({ error: 'Invalid group id.' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role');
  const status = searchParams.get('status');
  const source = searchParams.get('source');

  const conditions: string[] = [`group_id=$1`];
  const vals: unknown[] = [groupId];
  let idx = 2;

  if (role) { conditions.push(`role=$${idx++}`); vals.push(role); }
  if (status) { conditions.push(`status=$${idx++}`); vals.push(status); }
  if (source) { conditions.push(`source=$${idx++}`); vals.push(source); }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM meetup_member WHERE ${conditions.join(' AND ')} ORDER BY events_attended DESC, joined_date DESC`,
      vals
    );
    return Response.json({ members: res.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: Ctx): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const groupId = parseInt(params.id, 10);
  if (isNaN(groupId)) return Response.json({ error: 'Invalid group id.' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const { name, email, phone, joined_date, source, role, status, interests, notes } = body as Record<string, unknown>;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return Response.json({ error: 'Name required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(`
      INSERT INTO meetup_member
        (group_id, name, email, phone, joined_date, source, role, status, interests, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      groupId, name.trim(), email ?? null, phone ?? null,
      joined_date ?? null, source ?? null,
      role ?? 'member', status ?? 'active',
      Array.isArray(interests) ? interests : [],
      notes ?? null,
    ]);

    // Update current_members count
    await client.query(`UPDATE meetup_group SET current_members = (SELECT COUNT(*) FROM meetup_member WHERE group_id=$1 AND status='active') WHERE id=$1`, [groupId]);

    return Response.json({ member: res.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const groupId = parseInt(params.id, 10);
  if (isNaN(groupId)) return Response.json({ error: 'Invalid group id.' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const { memberId, role, status, events_attended, last_attended, notes } = body as Record<string, unknown>;

  if (!memberId) return Response.json({ error: 'memberId required.' }, { status: 400 });

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (role !== undefined) { sets.push(`role=$${idx++}`); vals.push(role); }
  if (status !== undefined) { sets.push(`status=$${idx++}`); vals.push(status); }
  if (events_attended !== undefined) { sets.push(`events_attended=$${idx++}`); vals.push(events_attended); }
  if (last_attended !== undefined) { sets.push(`last_attended=$${idx++}`); vals.push(last_attended); }
  if (notes !== undefined) { sets.push(`notes=$${idx++}`); vals.push(notes); }

  if (!sets.length) return Response.json({ error: 'No fields to update.' }, { status: 400 });

  vals.push(memberId);
  vals.push(groupId);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE meetup_member SET ${sets.join(',')} WHERE id=$${idx++} AND group_id=$${idx} RETURNING *`,
      vals
    );
    if (!res.rowCount) return Response.json({ error: 'Member not found.' }, { status: 404 });

    // Refresh count if status changed
    if (status !== undefined) {
      await client.query(`UPDATE meetup_group SET current_members = (SELECT COUNT(*) FROM meetup_member WHERE group_id=$1 AND status='active') WHERE id=$1`, [groupId]);
    }

    return Response.json({ member: res.rows[0] });
  } finally {
    client.release();
  }
}
