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
    const client = await pool.connect();
    try {
      const [memberRes, bookingsRes, checkinsRes] = await Promise.all([
        client.query(`SELECT * FROM gym_member WHERE id=$1`, [params.id]),
        client.query(`SELECT gb.*, gc.name AS class_name, gc.instructor FROM gym_booking gb LEFT JOIN gym_class gc ON gc.id=gb.class_id WHERE gb.member_id=$1 ORDER BY gb.booked_at DESC LIMIT 20`, [params.id]),
        client.query(`SELECT * FROM gym_checkin WHERE member_id=$1 ORDER BY checked_in_at DESC LIMIT 20`, [params.id]),
      ]);
      if (!memberRes.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ member: memberRes.rows[0], bookings: bookingsRes.rows, checkins: checkinsRes.rows });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = ['first_name','last_name','email','phone','date_of_birth','membership_type','membership_status','start_date','expiry_date','emergency_contact_name','emergency_contact_phone','health_waiver_signed','notes'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const f of fields) {
        if (body[f] !== undefined) { vals.push(body[f]); sets.push(`${f}=$${vals.length}`); }
      }
      if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
      vals.push(params.id);
      const { rows } = await client.query(`UPDATE gym_member SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      return Response.json({ member: rows[0] });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM gym_member WHERE id=$1`, [params.id]);
      return Response.json({ success: true });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
