import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real staff visibility into student_goal -- previously zero admin surface
// existed anywhere (found live during the 2026-09-01 admin-panel gap
// audit), so staff had no way to see what a student was working toward.
// Read-only: goals remain customer-authored, this just makes them visible.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const goals = await query(
    `SELECT sg.student_id, s.display_name AS student_name, sg.goal_code, g.label, sg.priority, sg.set_at
     FROM student_goal sg JOIN student s ON s.id = sg.student_id JOIN ref_yoga_goal g ON g.code = sg.goal_code
     ORDER BY s.display_name, sg.priority LIMIT 500`,
  );
  return Response.json({ goals: goals.rows });
}
