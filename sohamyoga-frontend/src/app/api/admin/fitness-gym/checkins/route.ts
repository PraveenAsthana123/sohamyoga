import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT gc.*, gm.first_name, gm.last_name, gm.email, gm.membership_type, gm.membership_status
        FROM gym_checkin gc
        LEFT JOIN gym_member gm ON gm.id = gc.member_id
        WHERE gc.checked_in_at::date = CURRENT_DATE
        ORDER BY gc.checked_in_at DESC
      `);
      return Response.json({ checkins: rows });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { member_id, check_in_method = 'staff' } = body;
    if (!member_id) return Response.json({ error: 'member_id required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const memberRes = await client.query(`SELECT id, first_name, last_name, membership_status FROM gym_member WHERE id=$1`, [member_id]);
      if (!memberRes.rows[0]) return Response.json({ error: 'Member not found' }, { status: 404 });
      if (memberRes.rows[0].membership_status === 'expired' || memberRes.rows[0].membership_status === 'cancelled') {
        return Response.json({ error: 'Membership is not active', status: memberRes.rows[0].membership_status }, { status: 403 });
      }
      const { rows } = await client.query(
        `INSERT INTO gym_checkin (member_id, check_in_method) VALUES ($1,$2) RETURNING *`,
        [member_id, check_in_method]
      );
      return Response.json({ checkin: rows[0], member: memberRes.rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
