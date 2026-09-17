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
    const { rows } = await client.query(`SELECT * FROM ds_students WHERE id = $1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Student not found' }, { status: 404 });

    const { rows: lessons } = await client.query(
      `SELECT dl.*, di.name AS instructor_name, dv.make || ' ' || dv.model AS vehicle
       FROM ds_lessons dl
       LEFT JOIN ds_instructors di ON di.id = dl.instructor_id
       LEFT JOIN ds_vehicles dv ON dv.id = dl.vehicle_id
       WHERE dl.student_id = $1 ORDER BY dl.lesson_date DESC LIMIT 20`,
      [params.id],
    );
    const { rows: roadTests } = await client.query(
      `SELECT * FROM ds_road_tests WHERE student_id = $1 ORDER BY test_date DESC`,
      [params.id],
    );

    return Response.json({ student: rows[0], lessons, road_tests: roadTests });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const allowed = ['first_name','last_name','email','phone','date_of_birth','alberta_id','program','lessons_purchased','lessons_completed','theory_test_passed','road_test_passed','road_test_attempts','status','notes'];
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
      `UPDATE ds_students SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!rows.length) return Response.json({ error: 'Student not found' }, { status: 404 });
    return Response.json({ student: rows[0] });
  } finally {
    client.release();
  }
}
