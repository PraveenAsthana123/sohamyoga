import { query } from '@/lib/db';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type PreferredTime = 'morning' | 'afternoon' | 'evening';
export type BudgetPeriod = 'per_class' | 'monthly';

export interface CustomerPreference {
  id: string;
  contactId: string;
  callId: string | null;
  preferredStyle: string | null;
  experienceLevel: ExperienceLevel | null;
  preferredTime: PreferredTime | null;
  sessionLengthMinutes: number | null;
  classesPerWeek: number | null;
  budgetAmount: number | null;
  budgetPeriod: BudgetPeriod | null;
  physicalNotes: string | null;
  collectedBy: string;
  createdAt: Date;
}

interface Row {
  id: string; contact_id: string; call_id: string | null;
  preferred_style: string | null; experience_level: ExperienceLevel | null; preferred_time: PreferredTime | null;
  session_length_minutes: number | null; classes_per_week: number | null;
  budget_amount: string | null; budget_period: BudgetPeriod | null;
  physical_notes: string | null; collected_by: string; created_at: Date;
}

function toEntity(r: Row): CustomerPreference {
  return {
    id: r.id, contactId: r.contact_id, callId: r.call_id,
    preferredStyle: r.preferred_style, experienceLevel: r.experience_level, preferredTime: r.preferred_time,
    sessionLengthMinutes: r.session_length_minutes, classesPerWeek: r.classes_per_week,
    budgetAmount: r.budget_amount !== null ? Number(r.budget_amount) : null, budgetPeriod: r.budget_period,
    physicalNotes: r.physical_notes, collectedBy: r.collected_by, createdAt: new Date(r.created_at),
  };
}

export interface RecordPreferenceInput {
  contactId: string;
  callId?: string | null;
  preferredStyle?: string | null;
  experienceLevel?: ExperienceLevel | null;
  preferredTime?: PreferredTime | null;
  sessionLengthMinutes?: number | null;
  classesPerWeek?: number | null;
  budgetAmount?: number | null;
  budgetPeriod?: BudgetPeriod | null;
  physicalNotes?: string | null;
  collectedBy: string;
}

export async function recordCustomerPreference(input: RecordPreferenceInput): Promise<CustomerPreference> {
  const { rows } = await query<Row>(
    `INSERT INTO customer_preference
       (contact_id, call_id, preferred_style, experience_level, preferred_time, session_length_minutes,
        classes_per_week, budget_amount, budget_period, physical_notes, collected_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      input.contactId, input.callId ?? null, input.preferredStyle ?? null, input.experienceLevel ?? null,
      input.preferredTime ?? null, input.sessionLengthMinutes ?? null, input.classesPerWeek ?? null,
      input.budgetAmount ?? null, input.budgetPeriod ?? null, input.physicalNotes ?? null, input.collectedBy,
    ]
  );
  return toEntity(rows[0]);
}

export async function listPreferencesForContact(contactId: string): Promise<CustomerPreference[]> {
  const { rows } = await query<Row>(
    'SELECT * FROM customer_preference WHERE contact_id = $1 ORDER BY created_at DESC',
    [contactId]
  );
  return rows.map(toEntity);
}

export interface PreferenceSummaryRow {
  preferredStyle: string;
  count: number;
}

export interface PreferenceReport {
  totalResponses: number;
  byStyle: PreferenceSummaryRow[];
  byTime: { preferredTime: string; count: number }[];
  byExperienceLevel: { experienceLevel: string; count: number }[];
  avgBudget: number | null;
  avgSessionLengthMinutes: number | null;
}

/** Real "what customers want" report -- aggregated from actual
 * admin-entered survey responses, empty/null when nothing has been
 * collected yet, never estimated or backfilled with plausible-looking data. */
export async function customerPreferenceReport(): Promise<PreferenceReport> {
  const [total, byStyle, byTime, byLevel, avgBudget, avgLength] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM customer_preference'),
    query<{ preferred_style: string; count: string }>(
      `SELECT preferred_style, COUNT(*)::text AS count FROM customer_preference
        WHERE preferred_style IS NOT NULL GROUP BY preferred_style ORDER BY COUNT(*) DESC`
    ),
    query<{ preferred_time: string; count: string }>(
      `SELECT preferred_time, COUNT(*)::text AS count FROM customer_preference
        WHERE preferred_time IS NOT NULL GROUP BY preferred_time ORDER BY COUNT(*) DESC`
    ),
    query<{ experience_level: string; count: string }>(
      `SELECT experience_level, COUNT(*)::text AS count FROM customer_preference
        WHERE experience_level IS NOT NULL GROUP BY experience_level ORDER BY COUNT(*) DESC`
    ),
    query<{ avg: string | null }>('SELECT AVG(budget_amount)::text AS avg FROM customer_preference WHERE budget_amount IS NOT NULL'),
    query<{ avg: string | null }>('SELECT AVG(session_length_minutes)::text AS avg FROM customer_preference WHERE session_length_minutes IS NOT NULL'),
  ]);
  return {
    totalResponses: Number(total.rows[0]?.count ?? 0),
    byStyle: byStyle.rows.map((r) => ({ preferredStyle: r.preferred_style, count: Number(r.count) })),
    byTime: byTime.rows.map((r) => ({ preferredTime: r.preferred_time, count: Number(r.count) })),
    byExperienceLevel: byLevel.rows.map((r) => ({ experienceLevel: r.experience_level, count: Number(r.count) })),
    avgBudget: avgBudget.rows[0]?.avg ? Number(avgBudget.rows[0].avg) : null,
    avgSessionLengthMinutes: avgLength.rows[0]?.avg ? Number(avgLength.rows[0].avg) : null,
  };
}
