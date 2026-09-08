import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { resolveStudent } from '@/lib/resolve-student';
import { toCsv, csvResponse } from '@/lib/export-csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ error: 'No student record found.' }, { status: 409 });

  const entries = await query(
    `SELECT entry_date::text AS entry_date, session_type, duration_minutes, mood_before, mood_after, energy_level, body_sensation, notes
     FROM practice_journal WHERE student_id = $1 ORDER BY entry_date DESC LIMIT 500`,
    [student.id],
  );

  const rows = (entries.rows as Record<string, unknown>[]).map(r => ({
    ...r, body_sensation: Array.isArray(r.body_sensation) ? (r.body_sensation as string[]).join('; ') : r.body_sensation,
  }));

  const csv = toCsv(rows, [
    { key: 'entry_date', header: 'Date' },
    { key: 'session_type', header: 'Session Type' },
    { key: 'duration_minutes', header: 'Duration (min)' },
    { key: 'mood_before', header: 'Mood Before (1-5)' },
    { key: 'mood_after', header: 'Mood After (1-5)' },
    { key: 'energy_level', header: 'Energy Level (1-5)' },
    { key: 'body_sensation', header: 'Body Sensation' },
    { key: 'notes', header: 'Notes' },
  ]);
  return csvResponse(csv, 'sohamyoga-practice-journal.csv');
}
