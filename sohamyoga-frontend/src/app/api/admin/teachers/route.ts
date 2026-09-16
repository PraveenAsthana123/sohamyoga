import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const [teachers, kpi, ratings, certs] = await Promise.all([
      client.query(
        `SELECT tp.id, tp.first_name, tp.last_name, tp.email, tp.phone, tp.bio,
                tp.status, tp.contract_type, tp.specializations, tp.hire_date, tp.created_at,
                COALESCE(AVG(tr.rating), 0)::numeric(3,2) AS avg_rating,
                COUNT(DISTINCT tr.id)::int AS rating_count,
                COUNT(DISTINCT tc.id)::int AS cert_count,
                COUNT(DISTINCT cs.id)::int AS session_count
         FROM teacher_profile tp
         LEFT JOIN teacher_rating tr ON tr.teacher_name = (tp.first_name || ' ' || tp.last_name)
         LEFT JOIN teacher_certification tc ON tc.teacher_id = tp.id
         LEFT JOIN class_session cs ON cs.teacher_id::text = tp.id::text
           AND cs.starts_at > NOW()
         GROUP BY tp.id
         ORDER BY tp.created_at DESC`,
      ),
      client.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'active')::int AS active,
           COALESCE(AVG(tr.rating), 0)::numeric(3,2) AS avg_rating,
           (SELECT COUNT(*)::int FROM teacher_certification) AS certs_issued
         FROM teacher_profile tp
         LEFT JOIN teacher_rating tr ON tr.teacher_name = (tp.first_name || ' ' || tp.last_name)`,
      ),
      client.query(
        `SELECT teacher_name, COUNT(*)::int AS rating_count,
                AVG(rating)::numeric(3,2) AS avg_rating,
                MAX(created_at) AS latest_at
         FROM teacher_rating
         GROUP BY teacher_name ORDER BY avg_rating DESC LIMIT 50`,
      ),
      client.query(
        `SELECT tc.id, tc.teacher_id, tp.first_name || ' ' || tp.last_name AS teacher_name,
                tc.certification_type::text AS cert_type, tc.issued_at, tc.expires_at, tc.status::text AS status
         FROM teacher_certification tc
         JOIN teacher_profile tp ON tp.id = tc.teacher_id
         ORDER BY tc.issued_at DESC LIMIT 100`,
      ),
    ]);

    return Response.json({
      teachers: teachers.rows,
      kpi: kpi.rows[0],
      ratings: ratings.rows,
      certifications: certs.rows,
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { id?: string; status?: string } | null;
  if (!body?.id || !body?.status) {
    return Response.json({ error: 'id and status are required.' }, { status: 400 });
  }
  const valid = ['trainee', 'active', 'on_leave', 'retired', 'terminated'];
  if (!valid.includes(body.status)) {
    return Response.json({ error: `status must be one of: ${valid.join(', ')}.` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE teacher_profile SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [body.id, body.status],
    );
    if (!result.rowCount) return Response.json({ error: 'Teacher not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
