import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { resolveStudent } from '@/lib/resolve-student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_TYPES = ['class', 'home', 'online', 'retreat'];

// Real practice journal -- replaces /ai/progress, which was a hardcoded
// SESSIONS array with no backing table at all. Entries are student-authored;
// nothing here is AI-generated or fabricated.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ entries: [], hasStudentRecord: false });

  const entries = await query(
    `SELECT id, entry_date, session_type, duration_minutes, mood_before, mood_after, energy_level, body_sensation, notes, created_at
     FROM practice_journal WHERE student_id = $1 ORDER BY entry_date DESC LIMIT 100`,
    [student.id],
  );
  return Response.json({ entries: entries.rows, hasStudentRecord: true });
}

export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    entryDate?: string; sessionType?: string; durationMinutes?: number;
    moodBefore?: number; moodAfter?: number; energyLevel?: number; bodySensation?: string[]; notes?: string;
  } | null;
  if (!body?.entryDate || !body.sessionType || !SESSION_TYPES.includes(body.sessionType)) {
    return Response.json({ error: `entryDate and a valid sessionType (${SESSION_TYPES.join('|')}) are required.` }, { status: 400 });
  }
  for (const [key, val] of [['moodBefore', body.moodBefore], ['moodAfter', body.moodAfter], ['energyLevel', body.energyLevel]] as const) {
    if (val !== undefined && (val < 1 || val > 5)) return Response.json({ error: `${key} must be between 1 and 5.` }, { status: 400 });
  }

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ error: 'A student record is required to log practice — enroll in a class first.' }, { status: 409 });

  const result = await query(
    `INSERT INTO practice_journal (tenant_id, student_id, entry_date, session_type, duration_minutes, mood_before, mood_after, energy_level, body_sensation, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (student_id, entry_date, session_type) DO UPDATE SET
       duration_minutes=EXCLUDED.duration_minutes, mood_before=EXCLUDED.mood_before, mood_after=EXCLUDED.mood_after,
       energy_level=EXCLUDED.energy_level, body_sensation=EXCLUDED.body_sensation, notes=EXCLUDED.notes, updated_at=now()
     RETURNING *`,
    [student.tenantId, student.id, body.entryDate, body.sessionType, body.durationMinutes ?? null,
      body.moodBefore ?? null, body.moodAfter ?? null, body.energyLevel ?? null, body.bodySensation ?? [], body.notes ?? null],
  );
  return Response.json({ entry: result.rows[0] }, { status: 201 });
}
