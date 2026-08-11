import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { SERVER_API_URL } from '@/lib/server-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO_TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';

/**
 * Real teacher onboarding, replacing the previous DEMO_TEACHERS mock array.
 * GET lists teacher_profile rows (added in migration 075 — the table the
 * existing teacher_certification/teacher_schedule tables already referenced
 * by teacher_id but which never existed until now).
 * POST creates a real ASP.NET Identity account with the Teacher role (via
 * the existing admin-gated /api/admin/users endpoint) and then a matching
 * teacher_profile row — an actual onboarded teacher who can log in, not a
 * placeholder record.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query(
    `SELECT id, user_id, first_name, last_name, email, phone, bio, status, contract_type, specializations, hire_date, created_at
     FROM teacher_profile ORDER BY created_at DESC`,
  );
  return Response.json({ teachers: rows.rows });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    firstName?: string; lastName?: string; email?: string; password?: string;
    phone?: string; bio?: string; specializations?: string[]; contractType?: string;
  } | null;

  if (!body?.firstName || !body.lastName || !body.email || !body.password) {
    return Response.json({ error: 'firstName, lastName, email and password are required.' }, { status: 400 });
  }

  const identityRes = await fetch(`${SERVER_API_URL}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
    body: JSON.stringify({ email: body.email, password: body.password, role: 'Teacher' }),
  });
  const identityData = await identityRes.json().catch(() => ({}));
  if (!identityRes.ok) {
    return Response.json({ error: identityData.detail || 'Failed to create teacher account.' }, { status: identityRes.status });
  }

  const teacher = await query(
    `INSERT INTO teacher_profile (tenant_id, user_id, first_name, last_name, email, phone, bio, specializations, contract_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, user_id, first_name, last_name, email, status, contract_type, specializations, hire_date, created_at`,
    [
      DEMO_TENANT_ID, identityData.id, body.firstName, body.lastName, body.email,
      body.phone ?? null, body.bio ?? null, body.specializations ?? [], body.contractType ?? 'employee',
    ],
  );

  return Response.json({ teacher: teacher.rows[0] }, { status: 201 });
}
