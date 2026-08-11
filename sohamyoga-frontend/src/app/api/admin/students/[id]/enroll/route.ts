import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO_TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';

/**
 * Creates a real active `enrollment` row for a student — the membership-
 * level enrollment ChurnPredictionJob and other jobs already key off
 * (JOIN enrollment e ON e.student_id = s.id AND e.status = 'active'), not a
 * per-class booking (that's the separate, already-real `booking` table).
 * course_id has no real course catalog table anywhere in this schema (only
 * class_session exists, which is booking-level, not course-level) — a
 * generated placeholder id is used here, the same honestly-documented
 * pattern established elsewhere this session for the same reason.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const student = await query(`SELECT id FROM student WHERE id = $1`, [params.id]);
  if (!student.rowCount) return Response.json({ error: 'Student not found.' }, { status: 404 });

  const existing = await query(`SELECT id FROM enrollment WHERE student_id = $1 AND status = 'active'`, [params.id]);
  if (existing.rowCount) return Response.json({ error: 'Student already has an active enrollment.' }, { status: 409 });

  const enrollment = await query(
    `INSERT INTO enrollment (tenant_id, student_id, course_id, status, start_date)
     VALUES ($1, $2, gen_random_uuid(), 'active', CURRENT_DATE)
     RETURNING id, student_id, status, start_date, enrolled_at`,
    [DEMO_TENANT_ID, params.id],
  );

  return Response.json({ enrollment: enrollment.rows[0] }, { status: 201 });
}
