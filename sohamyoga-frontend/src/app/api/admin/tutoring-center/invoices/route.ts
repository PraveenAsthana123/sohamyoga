import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || '';
  const student_id = searchParams.get('student_id') || '';
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT i.*, s.first_name, s.last_name, s.parent_email
        FROM tc_invoice i
        LEFT JOIN tc_student s ON s.id=i.student_id
        WHERE ($1='' OR i.status=$1)
          AND ($2='' OR i.student_id=$2::integer)
        ORDER BY i.invoice_date DESC
      `, [status, student_id]);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO tc_invoice (student_id, invoice_date, period_start, period_end, sessions_count, amount, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [
        body.student_id, body.invoice_date || new Date().toISOString().split('T')[0],
        body.period_start || null, body.period_end || null,
        body.sessions_count || null, body.amount, body.notes || null,
      ]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
