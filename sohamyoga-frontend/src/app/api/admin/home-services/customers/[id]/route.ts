import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const c = await client.query(`SELECT * FROM hs_customer WHERE id = $1`, [params.id]);
    if (!c.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const jobs = await client.query(`SELECT * FROM hs_job WHERE customer_id = $1 ORDER BY scheduled_at DESC LIMIT 50`, [params.id]);
    return Response.json({ ...c.rows[0], jobs: jobs.rows });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `UPDATE hs_customer SET first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name), phone=COALESCE($3,phone), email=COALESCE($4,email), address=COALESCE($5,address), service_notes=COALESCE($6,service_notes), gate_code=COALESCE($7,gate_code), pet_info=COALESCE($8,pet_info), alarm_code=COALESCE($9,alarm_code), status=COALESCE($10,status) WHERE id=$11 RETURNING *`,
      [b.first_name, b.last_name, b.phone, b.email, b.address, b.service_notes, b.gate_code, b.pet_info, b.alarm_code, b.status, params.id]
    );
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}
