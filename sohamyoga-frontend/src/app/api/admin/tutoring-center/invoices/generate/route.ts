import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { student_id, period_start, period_end } = body;
    if (!student_id || !period_start || !period_end) {
      return Response.json({ error: 'student_id, period_start, period_end required' }, { status: 400 });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows: sessions } = await client.query(`
        SELECT * FROM tc_session
        WHERE student_id=$1 AND session_date BETWEEN $2 AND $3 AND status='completed'
        ORDER BY session_date
      `, [student_id, period_start, period_end]);

      const totalAmount = sessions.reduce((sum, s) => sum + parseFloat(s.amount_billed || 0), 0);
      const { rows: studentRows } = await client.query(`SELECT * FROM tc_student WHERE id=$1`, [student_id]);
      if (!studentRows[0]) return Response.json({ error: 'Student not found' }, { status: 404 });

      const { rows: inv } = await client.query(`
        INSERT INTO tc_invoice (student_id, invoice_date, period_start, period_end, sessions_count, amount, notes)
        VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6) RETURNING *
      `, [
        student_id, period_start, period_end,
        sessions.length, totalAmount,
        `Auto-generated for ${sessions.length} completed sessions`,
      ]);
      return Response.json({ invoice: inv[0], sessions });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
