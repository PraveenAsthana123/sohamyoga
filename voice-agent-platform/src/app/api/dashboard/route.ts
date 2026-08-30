import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { countContacts } from '@/domain/contact/repository';
import { countSubmissions, countSubmissionsWithContact } from '@/domain/form/repository';
import { countScripts, scriptUsageCounts } from '@/domain/script/repository';
import { callsByStatus, callsPerDay, countCalls } from '@/domain/call/repository';

// Every number here comes from a real query against the live database.
// If nothing has happened yet, the counts are genuinely 0 — there is no
// fallback to sample/demo data anywhere in this route.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const [contactCount, submissionCount, submissionsWithContact, scriptCount, callCount, perDay, byStatus, usage] = await Promise.all([
    countContacts(),
    countSubmissions(),
    countSubmissionsWithContact(),
    countScripts(),
    countCalls(),
    callsPerDay(14),
    callsByStatus(),
    scriptUsageCounts(),
  ]);

  return NextResponse.json({
    totals: {
      contacts: contactCount,
      formSubmissions: submissionCount,
      formSubmissionsConvertedToContact: submissionsWithContact,
      callScripts: scriptCount,
      calls: callCount,
    },
    callsPerDay: perDay,
    callsByStatus: byStatus,
    scriptUsage: usage,
  });
}
