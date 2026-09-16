import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const memberRes = await client.query(`SELECT * FROM cw_member WHERE id = $1`, [params.id]);
    if (!memberRes.rows.length) return Response.json({ error: 'Member not found' }, { status: 404 });
    const bookings = await client.query(
      `SELECT b.*, s.space_name, s.space_type FROM cw_booking b
       LEFT JOIN cw_space s ON b.space_id = s.id
       WHERE b.member_id = $1 ORDER BY b.booking_date DESC, b.start_time DESC LIMIT 50`,
      [params.id]
    );
    return Response.json({ member: memberRes.rows[0], booking_history: bookings.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const allowed = ['first_name','last_name','email','phone','company','job_title',
    'membership_plan','membership_status','billing_cycle','monthly_rate','desk_number',
    'printer_access','mail_service','storage_locker','emergency_contact','notes'];
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in body) {
      updates.push(`${key} = $${idx++}`);
      values.push(body[key]);
    }
  }
  if ('access_24hr' in body) { updates.push(`"24hr_access" = $${idx++}`); values.push(body.access_24hr); }
  if (!updates.length) return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  values.push(params.id);
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE cw_member SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) return Response.json({ error: 'Member not found' }, { status: 404 });
    return Response.json({ member: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`UPDATE cw_member SET membership_status = 'cancelled' WHERE id = $1`, [params.id]);
    return Response.json({ success: true });
  } finally {
    client.release();
  }
}
