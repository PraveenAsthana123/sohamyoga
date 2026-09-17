import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const student_id = searchParams.get('student_id') ?? '';
  const instructor_id = searchParams.get('instructor_id') ?? '';
  const date = searchParams.get('date') ?? '';
  const status = searchParams.get('status') ?? '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ds_lessons (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid REFERENCES ds_students(id),
        instructor_id uuid REFERENCES ds_instructors(id),
        vehicle_id uuid REFERENCES ds_vehicles(id),
        lesson_date DATE,
        start_time TIME,
        duration_minutes INT DEFAULT 60,
        lesson_type TEXT,
        pickup_location TEXT,
        status TEXT DEFAULT 'scheduled',
        skills_covered TEXT[],
        instructor_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (student_id) { conditions.push(`dl.student_id = $${values.length + 1}`); values.push(student_id); }
    if (instructor_id) { conditions.push(`dl.instructor_id = $${values.length + 1}`); values.push(instructor_id); }
    if (date) { conditions.push(`dl.lesson_date = $${values.length + 1}`); values.push(date); }
    if (status && status !== 'all') { conditions.push(`dl.status = $${values.length + 1}`); values.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT dl.*,
              s.first_name || ' ' || s.last_name AS student_name,
              s.program AS student_program,
              i.name AS instructor_name,
              v.make || ' ' || v.model || ' (' || v.license_plate || ')' AS vehicle_label
       FROM ds_lessons dl
       LEFT JOIN ds_students s ON s.id = dl.student_id
       LEFT JOIN ds_instructors i ON i.id = dl.instructor_id
       LEFT JOIN ds_vehicles v ON v.id = dl.vehicle_id
       ${where} ORDER BY dl.lesson_date DESC, dl.start_time DESC LIMIT 300`,
      values,
    );

    return Response.json({ lessons: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { student_id, instructor_id, vehicle_id, lesson_date, start_time, duration_minutes, lesson_type, pickup_location, skills_covered } = body;

  if (!student_id || !lesson_date) {
    return Response.json({ error: 'student_id and lesson_date are required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ds_lessons (student_id, instructor_id, vehicle_id, lesson_date, start_time, duration_minutes, lesson_type, pickup_location, skills_covered)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [student_id, instructor_id || null, vehicle_id || null, lesson_date, start_time || null, duration_minutes || 60, lesson_type || null, pickup_location || null, skills_covered || []],
    );
    return Response.json({ lesson: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
