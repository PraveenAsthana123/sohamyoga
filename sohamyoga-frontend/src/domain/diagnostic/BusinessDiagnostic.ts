// Business Diagnostic — real Demand Map (from real class_session/booking
// data) + real Funnel Constraint (reusing the Opportunity Engine's #1
// candidate, already real). Business Model Category is a real, one-time
// admin confirmation (never an auto-classifier guessing a business this
// codebase already fully knows).

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export interface DemandMapEntry { className: string; realBookings: number; realCheckedIn: number }

// Pure, unit-tested: real demand ranking -- classes with zero real
// bookings sort last, never hidden (a real "no demand" signal is itself useful).
export function rankDemand(entries: DemandMapEntry[]): DemandMapEntry[] {
  return [...entries].sort((a, b) => b.realBookings - a.realBookings);
}

export async function getDemandMap(tenantId: string): Promise<DemandMapEntry[]> {
  const r = await db.query<{ class_name: string; bookings: string; checked_in: string }>(
    `SELECT cs.class_name, count(b.id)::text AS bookings, count(*) FILTER (WHERE b.status = 'checked_in')::text AS checked_in
     FROM class_session cs LEFT JOIN booking b ON b.class_session_id = cs.id AND b.status <> 'cancelled'
     WHERE cs.tenant_id = $1 GROUP BY cs.class_name`,
    [tenantId],
  );
  return rankDemand(r.rows.map((row) => ({ className: row.class_name, realBookings: Number(row.bookings), realCheckedIn: Number(row.checked_in) })));
}

export async function getFunnelConstraint(tenantId: string): Promise<{ dimension: string; priorityScore: number; recommendedSolution: string | null } | null> {
  const r = await db.query<{ kpi_dimension_key: string; priority_score: number; recommended_solution: string | null }>(
    `SELECT kpi_dimension_key, priority_score, recommended_solution FROM opportunity_candidate WHERE tenant_id = $1 ORDER BY rank ASC LIMIT 1`,
    [tenantId],
  );
  if (!r.rowCount) return null;
  return { dimension: r.rows[0].kpi_dimension_key, priorityScore: r.rows[0].priority_score, recommendedSolution: r.rows[0].recommended_solution };
}

export async function getBusinessProfile(tenantId: string) {
  const r = await db.query(`SELECT * FROM business_profile WHERE tenant_id = $1`, [tenantId]);
  return r.rows[0] ?? null;
}

export async function confirmBusinessProfile(tenantId: string, category: string, confirmedBy: string, notes: string) {
  const r = await db.query(
    `INSERT INTO business_profile (tenant_id, business_model_category, confirmed_by, notes)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id) DO UPDATE SET business_model_category=$2, confirmed_by=$3, notes=$4, updated_at=now()
     RETURNING *`,
    [tenantId, category, confirmedBy, notes],
  );
  return r.rows[0];
}
