import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { resolveStudent } from '@/lib/resolve-student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Read-only view of the real personalized_plan + plan_pose tables.
// created_by is a teacher/admin -- a customer views their plan, they don't
// author it, so this route is GET-only.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ plans: [], hasStudentRecord: false });

  interface PlanRow {
    id: string; name: string; description: string | null; focus_areas: string[]; weekly_sessions: number;
    session_minutes: number; difficulty: string; is_ai_generated: boolean; starts_on: string | null; ends_on: string | null;
  }
  const plans = await query<PlanRow>(
    `SELECT id, name, description, focus_areas, weekly_sessions, session_minutes, difficulty, is_ai_generated, starts_on, ends_on
     FROM personalized_plan WHERE student_id = $1 AND is_active = true ORDER BY created_at DESC`,
    [student.id],
  );
  const planIds = plans.rows.map(p => p.id);
  const poses = planIds.length
    ? await query(
        `SELECT pp.plan_id, pp.sequence_no, pp.hold_seconds, pp.cue, a.sanskrit_name, a.english_name, a.difficulty_level, a.image_url
         FROM plan_pose pp JOIN asana a ON a.id = pp.asana_id WHERE pp.plan_id = ANY($1) ORDER BY pp.plan_id, pp.sequence_no`,
        [planIds],
      )
    : { rows: [] as { plan_id: string }[] };

  const posesByPlan = new Map<string, unknown[]>();
  for (const pose of poses.rows as { plan_id: string }[]) {
    if (!posesByPlan.has(pose.plan_id)) posesByPlan.set(pose.plan_id, []);
    posesByPlan.get(pose.plan_id)!.push(pose);
  }
  const withPoses = plans.rows.map(p => ({ ...p, poses: posesByPlan.get(p.id) ?? [] }));
  return Response.json({ plans: withPoses, hasStudentRecord: true });
}
