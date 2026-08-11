import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real teacher profile + certifications, replacing the static TEACHER mock. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const teacher = await query(
    `SELECT id, user_id, first_name, last_name, email, phone, bio, timezone, status, contract_type, specializations, hire_date, created_at
     FROM teacher_profile WHERE id = $1`,
    [params.id],
  );
  if (!teacher.rowCount) return Response.json({ error: 'Teacher not found.' }, { status: 404 });

  const certifications = await query(
    `SELECT id, type, issuing_organization, certification_number, issued_at, expires_at, status
     FROM teacher_certification WHERE teacher_id = $1 ORDER BY issued_at DESC`,
    [params.id],
  );

  return Response.json({ teacher: teacher.rows[0], certifications: certifications.rows });
}
