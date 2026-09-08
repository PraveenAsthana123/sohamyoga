import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { recordCustomerPreference, listPreferencesForContact, ExperienceLevel, PreferredTime, BudgetPeriod } from '@/domain/contact/preferenceRepository';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;
  const preferences = await listPreferencesForContact(params.id);
  return NextResponse.json({ preferences });
}

/** Admin-entered only -- records what a customer said during a real survey
 * call (yoga_needs_survey or similar). There is no transcript-parsing/NLP
 * extraction here; an admin listens to or reads the call and enters it. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const VALID_LEVELS: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
  const VALID_TIMES: PreferredTime[] = ['morning', 'afternoon', 'evening'];
  const VALID_PERIODS: BudgetPeriod[] = ['per_class', 'monthly'];

  const experienceLevel = typeof body.experienceLevel === 'string' && VALID_LEVELS.includes(body.experienceLevel as ExperienceLevel) ? (body.experienceLevel as ExperienceLevel) : null;
  const preferredTime = typeof body.preferredTime === 'string' && VALID_TIMES.includes(body.preferredTime as PreferredTime) ? (body.preferredTime as PreferredTime) : null;
  const budgetPeriod = typeof body.budgetPeriod === 'string' && VALID_PERIODS.includes(body.budgetPeriod as BudgetPeriod) ? (body.budgetPeriod as BudgetPeriod) : null;

  try {
    const pref = await recordCustomerPreference({
      contactId: params.id,
      callId: typeof body.callId === 'string' ? body.callId : null,
      preferredStyle: typeof body.preferredStyle === 'string' ? body.preferredStyle : null,
      experienceLevel,
      preferredTime,
      sessionLengthMinutes: typeof body.sessionLengthMinutes === 'number' ? body.sessionLengthMinutes : null,
      classesPerWeek: typeof body.classesPerWeek === 'number' ? body.classesPerWeek : null,
      budgetAmount: typeof body.budgetAmount === 'number' ? body.budgetAmount : null,
      budgetPeriod,
      physicalNotes: typeof body.physicalNotes === 'string' ? body.physicalNotes : null,
      collectedBy: auth.principal.email,
    });
    return NextResponse.json(pref, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not record preference.' }, { status: 400 });
  }
}
