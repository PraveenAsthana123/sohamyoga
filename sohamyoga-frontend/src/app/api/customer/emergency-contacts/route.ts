import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { resolveStudent } from '@/lib/resolve-student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RELATIONSHIPS = ['parent', 'legal_guardian', 'spouse', 'other'];

// Real emergency contact / guardian management (student_guardian). Despite
// the schema comment "for minors", any student can record a real emergency
// contact -- there's no age gate in this table, and every studio benefits
// from having one on file.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ contacts: [], hasStudentRecord: false });

  const contacts = await query(`SELECT * FROM student_guardian WHERE student_id = $1 ORDER BY is_emergency DESC, created_at`, [student.id]);
  return Response.json({ contacts: contacts.rows, hasStudentRecord: true });
}

export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    guardianName?: string; relationship?: string; phone?: string; email?: string; isEmergency?: boolean;
  } | null;
  if (!body?.guardianName?.trim() || !body.relationship || !RELATIONSHIPS.includes(body.relationship)) {
    return Response.json({ error: `guardianName and a valid relationship (${RELATIONSHIPS.join('|')}) are required.` }, { status: 400 });
  }

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ error: 'A student record is required — enroll in a class first.' }, { status: 409 });

  const result = await query(
    `INSERT INTO student_guardian (student_id, tenant_id, guardian_name, relationship, phone, email, is_emergency)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [student.id, student.tenantId, body.guardianName.trim(), body.relationship, body.phone || null, body.email || null, body.isEmergency ?? false],
  );
  return Response.json({ contact: result.rows[0] }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ error: 'id query param is required.' }, { status: 400 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ error: 'No student record found.' }, { status: 404 });

  const result = await query(`DELETE FROM student_guardian WHERE id = $1 AND student_id = $2`, [id, student.id]);
  if (!result.rowCount) return Response.json({ error: 'Contact not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
