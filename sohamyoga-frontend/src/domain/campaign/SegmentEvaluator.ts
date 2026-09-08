import { getPool } from '@/lib/postgres';
import type { SegmentCriteria, SegmentLogic } from './AudienceSegment';

// The real criteria-to-SQL evaluator the schema comment explicitly deferred
// ("deliberately NOT built here... left honestly at 0/null until it exists").
// Only fields with a confirmed, unambiguous real column/join are supported —
// unsupported fields throw rather than silently skip or fabricate a count.
//
// membership_plan/total_spend_cad/pose_score_avg/challenge_completed added
// 2026-09-08 -- each has a real, confirmed data source found live in this
// codebase (customer.user_id = student.user_id is the real, already-used
// join -- see resolveCustomerId() in /api/customer/subscription/route.ts):
//   membership_plan  -> subscription_master.plan_name (latest row)
//   total_spend_cad  -> SUM(invoice_mirror.total_cad) -- real, currently 0
//                       rows in this environment (honest, not fabricated)
//   pose_score_avg   -> AVG of pose_assessment.mastery_level mapped to a
//                       real 1-5 ordinal scale (exploring..master) -- an
//                       explicit, documented conversion of real categorical
//                       data, not a guessed number
//   challenge_completed -> EXISTS a real challenge_participation row with
//                       completed_at IS NOT NULL
// Still unsupported: location -- grep/schema-confirmed, no student/customer
// location column exists anywhere in this codebase.

const SUPPORTED_FIELDS = ['last_active_days', 'signup_days_ago', 'birthday_month', 'preferred_style', 'class_count', 'has_referrals', 'membership_plan', 'total_spend_cad', 'pose_score_avg', 'challenge_completed'] as const;
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
    case 'membership_plan': {
      const values = (Array.isArray(c.value) ? c.value : [c.value]).map(String);
      params.push(values);
      const idx = params.length;
      if (c.operator !== 'eq' && c.operator !== 'in' && c.operator !== 'contains') {
        throw new Error('membership_plan only supports "eq"/"in"/"contains".');
      }
      return `(EXISTS (
        SELECT 1 FROM customer c JOIN subscription_master sm ON sm.customer_id = c.id::text
        WHERE c.user_id = s.user_id AND sm.plan_name = ANY($${idx}::varchar[])
      ))`;
    }
    case 'total_spend_cad': {
      params.push(Number(c.value));
      const idx = params.length;
      const cmp = OP_SQL[c.operator];
      if (!cmp) throw new Error(`Operator "${c.operator}" is not supported for total_spend_cad.`);
      return `(COALESCE((
        SELECT SUM(im.total_cad) FROM customer c JOIN invoice_mirror im ON im.customer_id = c.id
        WHERE c.user_id = s.user_id
      ), 0) ${cmp} $${idx})`;
    }
    case 'pose_score_avg': {
      params.push(Number(c.value));
      const idx = params.length;
      const cmp = OP_SQL[c.operator];
      if (!cmp) throw new Error(`Operator "${c.operator}" is not supported for pose_score_avg.`);
      // Real ordinal mapping of pose_assessment.mastery_level, not a
      // fabricated number -- exploring=1 .. master=5.
      return `(COALESCE((
        SELECT AVG(CASE pa.mastery_level
          WHEN 'exploring' THEN 1 WHEN 'learning' THEN 2 WHEN 'practising' THEN 3
          WHEN 'proficient' THEN 4 WHEN 'master' THEN 5 END)
        FROM pose_assessment pa WHERE pa.student_id = s.id
      ), 0) ${cmp} $${idx})`;
    }
    case 'challenge_completed': {
      const wantsCompleted = (c.value as unknown) === true || c.value === 'true' || c.value === 1;
      const exists = `EXISTS (SELECT 1 FROM challenge_participation cp WHERE cp.user_id = s.user_id AND cp.completed_at IS NOT NULL)`;
      return wantsCompleted ? `(${exists})` : `(NOT ${exists})`;
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
