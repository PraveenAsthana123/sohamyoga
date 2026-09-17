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
  const date = searchParams.get('date') ?? '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ds_road_tests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid REFERENCES ds_students(id),
        test_date DATE,
        test_center TEXT,
        test_type TEXT,
        attempt_number INT DEFAULT 1,
        result TEXT DEFAULT 'pending',
        failure_reasons TEXT[],
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (student_id) { conditions.push(`rt.student_id = $${values.length + 1}`); values.push(student_id); }
    if (date) { conditions.push(`rt.test_date = $${values.length + 1}`); values.push(date); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT rt.*, s.first_name || ' ' || s.last_name AS student_name, s.program AS student_program
       FROM ds_road_tests rt
       LEFT JOIN ds_students s ON s.id = rt.student_id
       ${where} ORDER BY rt.test_date DESC LIMIT 200`,
      values,
    );

    return Response.json({ road_tests: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { student_id, test_date, test_center, test_type, attempt_number, result, failure_reasons, notes } = body;

  if (!student_id || !test_date) {
    return Response.json({ error: 'student_id and test_date are required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO ds_road_tests (student_id, test_date, test_center, test_type, attempt_number, result, failure_reasons, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [student_id, test_date, test_center || null, test_type || null, attempt_number || 1, result || 'pending', failure_reasons || [], notes || null],
    );

    // Update student stats
    if (result === 'passed') {
      await client.query(
        `UPDATE ds_students SET road_test_passed = true, road_test_attempts = road_test_attempts + 1 WHERE id = $1`,
        [student_id],
      );
    } else if (result && result !== 'pending') {
      await client.query(
        `UPDATE ds_students SET road_test_attempts = road_test_attempts + 1 WHERE id = $1`,
        [student_id],
      );
    }

    await client.query('COMMIT');
    return Response.json({ road_test: rows[0] }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
