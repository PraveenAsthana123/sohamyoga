import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const log_type = searchParams.get('log_type');
  const date = searchParams.get('date');
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT * FROM cr_compliance_log
      WHERE ($1::text IS NULL OR log_type=$1)
        AND ($2::text IS NULL OR DATE(created_at)=$2::date)
      ORDER BY created_at DESC LIMIT 200
    `, [log_type||null, date||null]);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { log_type, staff_involved, customer_info, description, action_taken, aglc_report_required } = body;
  if (!log_type || !description) return Response.json({ error: 'log_type, description required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      INSERT INTO cr_compliance_log (log_type, staff_involved, customer_info, description, action_taken, aglc_report_required)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [log_type, staff_involved||null, customer_info||null, description, action_taken||null, aglc_report_required??false]);
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
