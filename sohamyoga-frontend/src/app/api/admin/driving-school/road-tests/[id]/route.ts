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
      `SELECT rt.*, s.first_name || ' ' || s.last_name AS student_name, s.program AS student_program
       FROM ds_road_tests rt
       LEFT JOIN ds_students s ON s.id = rt.student_id
       WHERE rt.id = $1`,
      [params.id],
    );
    if (!rows.length) return Response.json({ error: 'Road test not found' }, { status: 404 });
    return Response.json({ road_test: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const allowed = ['test_date','test_center','test_type','attempt_number','result','failure_reasons','notes'];
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
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE ds_road_tests SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Road test not found' }, { status: 404 });
    }

    // Sync road_test_passed on student if result changed
    if ('result' in body) {
      if (body.result === 'passed') {
        await client.query(`UPDATE ds_students SET road_test_passed = true WHERE id = $1`, [rows[0].student_id]);
      } else if (body.result === 'failed') {
        // Only revert if no other passed test exists
        const { rows: otherPassed } = await client.query(
          `SELECT 1 FROM ds_road_tests WHERE student_id = $1 AND result = 'passed' AND id != $2 LIMIT 1`,
          [rows[0].student_id, params.id],
        );
        if (!otherPassed.length) {
          await client.query(`UPDATE ds_students SET road_test_passed = false WHERE id = $1`, [rows[0].student_id]);
        }
      }
    }

    await client.query('COMMIT');
    return Response.json({ road_test: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
