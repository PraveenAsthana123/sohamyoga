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
    const setting = searchParams.get('setting');
    const ot = searchParams.get('ot');
    const client_id = searchParams.get('client_id');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (date) { params.push(date); conditions.push(`s.session_date=$${params.length}`); }
    if (setting) { params.push(setting); conditions.push(`s.session_setting=$${params.length}`); }
    if (ot) { params.push(ot); conditions.push(`s.ot=$${params.length}`); }
    if (client_id) { params.push(parseInt(client_id)); conditions.push(`s.client_id=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT s.*, c.first_name, c.last_name, c.funding_source, c.wca_claim, c.diagnosis
       FROM ot_session s JOIN ot_client c ON c.id=s.client_id
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
      `INSERT INTO ot_session (client_id,ot,session_date,start_time,end_time,session_setting,session_type,status,fee)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.client_id,b.ot,b.session_date,b.start_time,b.end_time,
       b.session_setting||'clinic',b.session_type||'treatment',b.status||'scheduled',b.fee||null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
