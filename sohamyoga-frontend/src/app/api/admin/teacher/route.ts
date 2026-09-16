export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const client = await pool.connect();
  try {
    const [teachers, ratings, certs, schedules] = await Promise.all([
      client.query(`
        SELECT tp.id, tp.first_name, tp.last_name, tp.email, tp.phone,
          tp.bio, tp.status, tp.contract_type, tp.specializations,
          tp.hire_date, tp.created_at,
          COUNT(DISTINCT cs.id) as total_sessions,
          COUNT(DISTINCT CASE WHEN cs.starts_at >= NOW() THEN cs.id END) as upcoming_sessions
        FROM teacher_profile tp
        LEFT JOIN class_session cs ON cs.teacher_id = tp.user_id
        GROUP BY tp.id
        ORDER BY tp.first_name, tp.last_name
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT tr.teacher_id,
          ROUND(AVG(tr.rating)::numeric, 2) as avg_rating,
          COUNT(*) as rating_count
        FROM teacher_rating tr
        GROUP BY tr.teacher_id
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT tc.teacher_id, tc.certification_name, tc.issuing_body,
          tc.issued_at, tc.expires_at, tc.status
        FROM teacher_certification tc
        ORDER BY tc.issued_at DESC
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT tws.teacher_id, tws.day_of_week, tws.start_time, tws.end_time
        FROM teacher_weekly_slot tws
        ORDER BY tws.day_of_week, tws.start_time
      `).catch(() => ({ rows: [] })),
    ]);

    // Merge ratings into teachers
    const ratingMap = new Map(ratings.rows.map(r => [r.teacher_id, r]));
    const enrichedTeachers = teachers.rows.map(t => ({
      ...t,
      avg_rating: ratingMap.get(t.id)?.avg_rating ?? null,
      rating_count: ratingMap.get(t.id)?.rating_count ?? 0,
    }));

    const summary = {
      total: teachers.rows.length,
      active: teachers.rows.filter(t => t.status === 'active').length,
      certifications: certs.rows.length,
      scheduleSlots: schedules.rows.length,
    };

    return Response.json({
      teachers: enrichedTeachers,
      certifications: certs.rows,
      schedules: schedules.rows,
      summary,
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as { id: string; status?: string; contract_type?: string };
  if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });

  const allowed = ['active', 'inactive', 'suspended', 'on_leave'];
  if (body.status && !allowed.includes(body.status)) {
    return Response.json({ error: `status must be one of ${allowed.join(', ')}` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (body.status) { fields.push(`status = $${idx++}`); params.push(body.status); }
    if (body.contract_type) { fields.push(`contract_type = $${idx++}`); params.push(body.contract_type); }

    if (!fields.length) return Response.json({ error: 'no fields to update' }, { status: 400 });
    params.push(body.id);

    const res = await client.query(
      `UPDATE teacher_profile SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (!res.rowCount) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ teacher: res.rows[0] });
  } finally {
    client.release();
  }
}
