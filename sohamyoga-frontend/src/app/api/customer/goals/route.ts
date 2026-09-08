import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { resolveStudent } from '@/lib/resolve-student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real structured goals (student_goal + ref_yoga_goal), distinct from the
// free-text goal_statement in /api/customer/preferences.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  const catalog = await query(`SELECT code, label FROM ref_yoga_goal ORDER BY label`);
  if (!student) return Response.json({ goals: [], catalog: catalog.rows, hasStudentRecord: false });

  const goals = await query(
    `SELECT sg.goal_code, sg.priority, sg.set_at, g.label FROM student_goal sg
     JOIN ref_yoga_goal g ON g.code = sg.goal_code WHERE sg.student_id = $1 ORDER BY sg.priority`,
    [student.id],
  );
  return Response.json({ goals: goals.rows, catalog: catalog.rows, hasStudentRecord: true });
}

export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { goalCode?: string; priority?: number } | null;
  if (!body?.goalCode) return Response.json({ error: 'goalCode is required.' }, { status: 400 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ error: 'A student record is required to set goals — enroll in a class first.' }, { status: 409 });

  const validCode = await query(`SELECT code FROM ref_yoga_goal WHERE code = $1`, [body.goalCode]);
  if (!validCode.rowCount) return Response.json({ error: 'Unknown goal code.' }, { status: 400 });

  const result = await query(
    `INSERT INTO student_goal (student_id, goal_code, priority) VALUES ($1,$2,$3)
     ON CONFLICT (student_id, goal_code) DO UPDATE SET priority = EXCLUDED.priority RETURNING *`,
    [student.id, body.goalCode, body.priority ?? 1],
  );
  return Response.json({ goal: result.rows[0] }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const goalCode = req.nextUrl.searchParams.get('goalCode');
  if (!goalCode) return Response.json({ error: 'goalCode query param is required.' }, { status: 400 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ error: 'No student record found.' }, { status: 404 });

  const result = await query(`DELETE FROM student_goal WHERE student_id = $1 AND goal_code = $2`, [student.id, goalCode]);
  if (!result.rowCount) return Response.json({ error: 'Goal not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
