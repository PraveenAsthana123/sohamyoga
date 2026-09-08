import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real staff visibility into student_guardian -- previously zero admin
// surface existed anywhere (found live during the 2026-09-01 admin-panel
// gap audit). This is a real safety gap: emergency contact data is meant
// to matter during an actual in-class incident, and only direct DB access
// could read it before this route existed.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const contacts = await query(
    `SELECT sg.id, sg.student_id, s.display_name AS student_name, sg.guardian_name, sg.relationship, sg.phone, sg.email, sg.is_emergency, sg.created_at
     FROM student_guardian sg JOIN student s ON s.id = sg.student_id
     ORDER BY sg.is_emergency DESC, s.display_name LIMIT 500`,
  );
  return Response.json({ contacts: contacts.rows });
}
