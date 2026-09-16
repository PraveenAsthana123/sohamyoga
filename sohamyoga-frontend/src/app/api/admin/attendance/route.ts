export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500);
  const status = searchParams.get('status');

  const client = await pool.connect();
  try {
    const whereParts: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (status) { whereParts.push(`ar.status = $${idx++}`); params.push(status); }

    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const records = await client.query(`
      SELECT ar.id, ar.status, ar.check_in_method, ar.attended_at, ar.created_at,
        s.display_name as student_name, s.email as student_email,
        cs.starts_at, cs.location_name
      FROM attendance_record ar
      LEFT JOIN student s ON s.id = ar.student_id
      LEFT JOIN class_session cs ON cs.id = ar.class_session_id
      ${where}
      ORDER BY ar.attended_at DESC NULLS LAST, ar.created_at DESC
      LIMIT $${idx}
    `, [...params, limit]);

    const summary = await client.query(`
      SELECT status, COUNT(*) as count
      FROM attendance_record
      GROUP BY status
    `);

    const weeklyTrend = await client.query(`
      SELECT DATE_TRUNC('day', COALESCE(attended_at, created_at)) as day,
        COUNT(*) as count, status
      FROM attendance_record
      WHERE COALESCE(attended_at, created_at) >= NOW() - INTERVAL '14 days'
      GROUP BY 1, status
      ORDER BY 1
    `);

    const summaryMap = summary.rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = Number(r.count);
      return acc;
    }, {});

    return NextResponse.json({
      records: records.rows,
      summary: {
        total: records.rowCount ?? 0,
        ...summaryMap,
      },
      weeklyTrend: weeklyTrend.rows,
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as { id: string; status: string };
  if (!body.id || !body.status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

  const allowed = ['present', 'absent', 'late', 'excused', 'cancelled'];
  if (!allowed.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${allowed.join(', ')}` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE attendance_record SET status = $1 WHERE id = $2 RETURNING *`,
      [body.status, body.id]
    );
    if (!res.rowCount) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ record: res.rows[0] });
  } finally {
    client.release();
  }
}
