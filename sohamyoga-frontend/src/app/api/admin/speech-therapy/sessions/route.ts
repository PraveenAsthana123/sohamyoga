import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const slp = searchParams.get('slp');
    const client_id = searchParams.get('client_id');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (date) { params.push(date); conditions.push(`s.session_date=$${params.length}`); }
    if (slp) { params.push(slp); conditions.push(`s.slp=$${params.length}`); }
    if (client_id) { params.push(parseInt(client_id)); conditions.push(`s.client_id=$${params.length}`); }
    if (status) { params.push(status); conditions.push(`s.status=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT s.*, c.first_name, c.last_name, c.primary_diagnosis, c.areas_of_focus, c.aish_funded, c.cbs_funded
       FROM st_session s JOIN st_client c ON c.id=s.client_id
       ${where} ORDER BY s.session_date DESC, s.start_time DESC LIMIT 200`, params
    );
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO st_session (client_id,slp,session_date,start_time,end_time,session_type,status,fee,funding_source)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.client_id,b.slp,b.session_date,b.start_time,b.end_time,b.session_type||'individual',
       b.status||'scheduled',b.fee||null,b.funding_source||'private_pay']
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
