import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Pure, unit-tested: real Sean Ellis PMF threshold -- PMF achieved when
// >=40% of real responses are "very_disappointed", the field's own
// standard benchmark, not invented here. Null (not false) with zero
// real responses -- a real "not enough data" state.
export function computePmfScore(veryDisappointed: number, total: number): { pct: number | null; pmfAchieved: boolean | null } {
  if (total === 0) return { pct: null, pmfAchieved: null };
  const pct = Math.round((veryDisappointed / total) * 1000) / 10;
  return { pct, pmfAchieved: pct >= 40 };
}

export async function getPmfAndActivation(tenantId: string) {
  const [activation, pmf] = await Promise.all([
    db.query<{ total: string; activated: string }>(
      `SELECT count(DISTINCT s.id)::text AS total, count(DISTINCT b.student_id)::text AS activated
       FROM student s LEFT JOIN booking b ON b.student_id = s.id AND b.status = 'checked_in'
       WHERE s.tenant_id = $1`,
      [tenantId],
    ),
    db.query<{ total: string; very: string }>(
      `SELECT count(*)::text AS total, count(*) FILTER (WHERE response = 'very_disappointed')::text AS very
       FROM pmf_survey_response WHERE tenant_id = $1`,
      [tenantId],
    ),
  ]);
  const total = Number(activation.rows[0].total), activated = Number(activation.rows[0].activated);
  const pmfTotal = Number(pmf.rows[0].total), veryDisappointed = Number(pmf.rows[0].very);
  return {
    activation: { totalStudents: total, activatedStudents: activated, activationRate: total > 0 ? Math.round((activated / total) * 1000) / 10 : null },
    pmf: { totalResponses: pmfTotal, ...computePmfScore(veryDisappointed, pmfTotal) },
  };
}
