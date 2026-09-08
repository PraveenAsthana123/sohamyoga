import { getPool } from '@/lib/postgres';
import type { SegmentCriteria, SegmentLogic } from './AudienceSegment';

// The real criteria-to-SQL evaluator the schema comment explicitly deferred
// ("deliberately NOT built here... left honestly at 0/null until it exists").
// Only fields with a confirmed, unambiguous real column/join are supported —
// unsupported fields throw rather than silently skip or fabricate a count.
// Unsupported: membership_plan/total_spend_cad (no confirmed subscription-to-
// student linkage exists anywhere else in this codebase to safely reuse),
// pose_score_avg/location/challenge_completed (no backing column found).

const SUPPORTED_FIELDS = ['last_active_days', 'signup_days_ago', 'birthday_month', 'preferred_style', 'class_count', 'has_referrals'] as const;
type SupportedField = typeof SUPPORTED_FIELDS[number];

function isSupported(field: string): field is SupportedField {
  return (SUPPORTED_FIELDS as readonly string[]).includes(field);
}

const OP_SQL: Record<string, string> = { eq: '=', ne: '<>', gt: '>', lt: '<', gte: '>=', lte: '<=' };

function criterionToSql(c: SegmentCriteria, params: unknown[]): string {
  if (!isSupported(c.field)) {
    throw new Error(`Segment field "${c.field}" has no real, confirmed data mapping in this app yet — refusing to fabricate a count for it.`);
  }

  switch (c.field) {
    case 'last_active_days': {
      params.push(Number(c.value));
      const idx = params.length;
      const cmp = OP_SQL[c.operator];
      if (!cmp) throw new Error(`Operator "${c.operator}" is not supported for last_active_days.`);
      return `(s.last_class_at IS NOT NULL AND EXTRACT(DAY FROM now() - s.last_class_at) ${cmp} $${idx})`;
    }
    case 'signup_days_ago': {
      params.push(Number(c.value));
      const idx = params.length;
      const cmp = OP_SQL[c.operator];
      if (!cmp) throw new Error(`Operator "${c.operator}" is not supported for signup_days_ago.`);
      return `(EXTRACT(DAY FROM now() - s.enrolled_at) ${cmp} $${idx})`;
    }
    case 'birthday_month': {
      params.push(Number(c.value));
      const idx = params.length;
      if (c.operator !== 'eq') throw new Error('birthday_month only supports the "eq" operator.');
      return `(s.date_of_birth IS NOT NULL AND EXTRACT(MONTH FROM s.date_of_birth) = $${idx})`;
    }
    case 'preferred_style': {
      const values = Array.isArray(c.value) ? c.value : [c.value];
      params.push(values.map(String));
      const idx = params.length;
      if (c.operator !== 'contains' && c.operator !== 'in') throw new Error('preferred_style only supports "contains"/"in".');
      return `(s.yoga_style_preference && $${idx}::varchar[])`;
    }
    case 'class_count': {
      params.push(Number(c.value));
      const idx = params.length;
      const cmp = OP_SQL[c.operator];
      if (!cmp) throw new Error(`Operator "${c.operator}" is not supported for class_count.`);
      return `((SELECT count(*) FROM attendance_record a WHERE a.student_id = s.id AND a.status = 'attended') ${cmp} $${idx})`;
    }
    case 'has_referrals': {
      const wantsReferrals = (c.value as unknown) === true || c.value === 'true' || c.value === 1;
      const exists = `EXISTS (SELECT 1 FROM referral_master rm WHERE rm.referrer_id = s.id)`;
      return wantsReferrals ? `(${exists})` : `(NOT ${exists})`;
    }
  }
}

export interface SegmentEvaluationResult {
  count: number;
  sql: string;
}

export async function evaluateSegment(criteria: SegmentCriteria[], logic: SegmentLogic): Promise<SegmentEvaluationResult> {
  if (criteria.length === 0) throw new Error('At least one criterion is required.');
  const params: unknown[] = [];
  const clauses = criteria.map(c => criterionToSql(c, params));
  const where = clauses.join(logic === 'OR' ? ' OR ' : ' AND ');
  const sql = `SELECT count(*)::int AS count FROM student s WHERE ${where}`;
  const result = await getPool().query<{ count: number }>(sql, params);
  return { count: result.rows[0]?.count ?? 0, sql };
}
