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
      `SELECT dl.*,
              s.first_name || ' ' || s.last_name AS student_name,
              s.program AS student_program,
              i.name AS instructor_name,
              v.make || ' ' || v.model AS vehicle_label
       FROM ds_lessons dl
       LEFT JOIN ds_students s ON s.id = dl.student_id
       LEFT JOIN ds_instructors i ON i.id = dl.instructor_id
       LEFT JOIN ds_vehicles v ON v.id = dl.vehicle_id
       WHERE dl.id = $1`,
      [params.id],
    );
    if (!rows.length) return Response.json({ error: 'Lesson not found' }, { status: 404 });
    return Response.json({ lesson: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const allowed = ['instructor_id','vehicle_id','lesson_date','start_time','duration_minutes','lesson_type','pickup_location','status','skills_covered','instructor_notes'];
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
      `UPDATE ds_lessons SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!rows.length) return Response.json({ error: 'Lesson not found' }, { status: 404 });
    return Response.json({ lesson: rows[0] });
  } finally {
    client.release();
  }
}
