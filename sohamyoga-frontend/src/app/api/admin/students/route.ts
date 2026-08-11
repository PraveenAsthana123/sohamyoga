import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { SERVER_API_URL } from '@/lib/server-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO_TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';

/**
 * Real student enrollment, replacing the previous DEMO_STUDENTS mock array.
 * GET lists the real student table. POST creates a real ASP.NET Identity
 * Customer account (via the admin-only /api/customer/auth/admin-create
 * endpoint) and the matching student row — an actual person who can log
 * into the customer portal, not a placeholder record.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query(
    `SELECT s.id, s.user_id, s.display_name, s.email, s.status, s.journey_phase, s.experience_level,
            s.yoga_style_preference, s.enrolled_at, s.first_class_at, s.last_class_at,
            EXISTS (SELECT 1 FROM enrollment e WHERE e.student_id = s.id AND e.status = 'active') AS has_active_enrollment
     FROM student s ORDER BY s.enrolled_at DESC`,
  );
  return Response.json({ students: rows.rows });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    displayName?: string; email?: string; password?: string;
    experienceLevel?: string; yogaStylePreference?: string[];
  } | null;

  if (!body?.displayName || !body.email || !body.password) {
    return Response.json({ error: 'displayName, email and password are required.' }, { status: 400 });
  }

  const identityRes = await fetch(`${SERVER_API_URL}/api/customer/auth/admin-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
    body: JSON.stringify({ name: body.displayName, email: body.email, password: body.password }),
  });
  const identityData = await identityRes.json().catch(() => ({}));
  if (!identityRes.ok) {
    return Response.json({ error: identityData.detail || 'Failed to create student account.' }, { status: identityRes.status });
  }

  const student = await query(
    `INSERT INTO student (tenant_id, user_id, display_name, email, status, experience_level, yoga_style_preference)
     VALUES ($1, $2, $3, $4, 'active', $5, $6)
     RETURNING id, user_id, display_name, email, status, experience_level, yoga_style_preference, enrolled_at`,
    [
      DEMO_TENANT_ID, identityData.user.id, body.displayName, body.email,
      body.experienceLevel ?? 'beginner', body.yogaStylePreference ?? [],
    ],
  );

  return Response.json({ student: student.rows[0] }, { status: 201 });
}
