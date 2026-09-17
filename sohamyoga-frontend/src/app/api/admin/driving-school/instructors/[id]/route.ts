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
    const { rows } = await client.query(`SELECT * FROM ds_instructors WHERE id = $1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Instructor not found' }, { status: 404 });

    const { rows: lessons } = await client.query(
      `SELECT dl.lesson_date, dl.start_time, dl.duration_minutes, dl.status,
              s.first_name || ' ' || s.last_name AS student_name
       FROM ds_lessons dl
       LEFT JOIN ds_students s ON s.id = dl.student_id
       WHERE dl.instructor_id = $1 ORDER BY dl.lesson_date DESC LIMIT 20`,
      [params.id],
    );

    return Response.json({ instructor: rows[0], recent_lessons: lessons });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const allowed = ['name','email','phone','instructor_cert_number','cert_expiry','license_classes','hourly_rate','status','notes'];
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${values.length + 1}`);
      values.push(body[key]);
    }
  }
  if (!sets.length) return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  values.push(params.id);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE ds_instructors SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!rows.length) return Response.json({ error: 'Instructor not found' }, { status: 404 });
    return Response.json({ instructor: rows[0] });
  } finally {
    client.release();
  }
}
