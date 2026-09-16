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
    const { rows } = await client.query(
      `SELECT s.*, c.first_name, c.last_name, c.diagnosis, c.funding_source
       FROM ot_session s JOIN ot_client c ON c.id=s.client_id WHERE s.id=$1`, [parseInt(params.id)]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id);
    const b = await req.json();
    const allowed = ['status','session_date','start_time','end_time','ot','session_setting','session_type'];
    const fields = Object.entries(b).filter(([k]) => allowed.includes(k)).map(([k], i) => `${k}=$${i + 2}`);
    const values = Object.entries(b).filter(([k]) => allowed.includes(k)).map(([, v]) => v);
    if (!fields.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
    const { rows } = await client.query(`UPDATE ot_session SET ${fields.join(',')} WHERE id=$1 RETURNING *`, [id, ...values]);
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
