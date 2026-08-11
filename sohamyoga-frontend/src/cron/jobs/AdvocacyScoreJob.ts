// AdvocacyScoreJob — Weekly Thursday 08:30 UTC
// Computes a real composite advocacy-eligibility score per active student —
// the second stage of the growth-loop architecture (Funnel → Advocacy/
// Referral → Viral → Influencer). Scoped to signals this platform actually
// has: NPS (survey_answer/survey_response, email-joined — respondent_id is
// not populated in real data), attendance_record count, enrollment
// retention (student.enrolled_at), real referral_master success count for
// that student as referrer, and churn_prediction.risk_level as an override
// ("a recent problem overrides an old positive score" per spec). Positive
// feedback / organic sharing / complaint counts are NOT included — no
// per-student link exists yet between sentiment_log and a student, so
// including them would mean guessing, not computing.
//
// Ollama is used only to write one advisory sentence for the single most
// borderline eligibility case each run — it explains an already-computed
// score, it never invents the numbers.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

type Eligibility = 'strong_candidate' | 'nurture' | 'wait' | 'ineligible';

const THRESHOLDS = { strong: 60, nurture: 35, wait: 15 } as const;

function extractText(raw: string): string {
  return raw.trim().replace(/^```(?:text)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

function eligibilityFor(score: number, hasRecentProblem: boolean): Eligibility {
  if (hasRecentProblem) return 'wait';
  if (score >= THRESHOLDS.strong) return 'strong_candidate';
  if (score >= THRESHOLDS.nurture) return 'nurture';
  if (score >= THRESHOLDS.wait) return 'wait';
  return 'ineligible';
}

// Documented, bounded composite formula — max ~92 points:
//   NPS        (0-40): promoter (>=9) = 40, passive (7-8) = 20, detractor/none = 0
//   Attendance (0-20): 1 point per attended class, capped at 20
//   Retention  (0-12): 1 point per full month enrolled, capped at 12
//   Referrals  (0-20): 4 points per successful referral (verified+), capped at 5 referrals
function compositeScore(npsScore: number | null, attendanceCount: number, retentionDays: number, referralCount: number): number {
  const npsPoints = npsScore === null ? 0 : npsScore >= 9 ? 40 : npsScore >= 7 ? 20 : 0;
  const attendancePoints = Math.min(attendanceCount, 20);
  const retentionPoints = Math.min(Math.floor(retentionDays / 30), 12);
  const referralPoints = Math.min(referralCount, 5) * 4;
  return npsPoints + attendancePoints + retentionPoints + referralPoints;
}

export async function run(): Promise<void> {
  const tenant = await db.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
  if (!tenant.rowCount) { console.log('[advocacy-score] no tenant configured, skipping'); return; }
  const tenantId = tenant.rows[0].id;

  const students = await db.query<{
    student_id: string; email: string; nps_score: number | null;
    attendance_count: string; retention_days: string; risk_level: string | null;
  }>(
    `SELECT
       s.id AS student_id, s.email,
       (SELECT AVG(a.value_number) FROM survey_answer a
          JOIN survey_question q ON q.id = a.question_id AND q.type = 'nps'
          JOIN survey_response sr ON sr.id = a.response_id
          WHERE sr.respondent_email = s.email) AS nps_score,
       (SELECT COUNT(*) FROM attendance_record ar WHERE ar.student_id = s.id AND ar.status = 'present')::text AS attendance_count,
       EXTRACT(DAY FROM NOW() - s.enrolled_at)::text AS retention_days,
       cp.risk_level
     FROM student s
     LEFT JOIN churn_prediction cp ON cp.student_id = s.id
     WHERE s.status = 'active'`,
  );

  if (!students.rowCount) { console.log('[advocacy-score] no active students, skipping'); return; }

  let mostBorderline: { studentId: string; score: number; distance: number; hasRecentProblem: boolean; eligibility: Eligibility } | null = null;

  for (const s of students.rows) {
    const referralCountRes = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM referral_master
       WHERE referrer_id = $1 AND status IN ('verified','membership_purchased','reward_pending','reward_approved','reward_paid')`,
      [s.student_id],
    );
    const referralCount = Number(referralCountRes.rows[0].n);
    const attendanceCount = Number(s.attendance_count);
    const retentionDays = Number(s.retention_days);
    const hasRecentProblem = s.risk_level === 'high' || s.risk_level === 'critical';
    const score = compositeScore(s.nps_score, attendanceCount, retentionDays, referralCount);
    const eligibility = eligibilityFor(score, hasRecentProblem);

    await db.query(
      `INSERT INTO advocacy_score (tenant_id, student_id, nps_score, attendance_count, retention_days, referral_count, has_recent_problem, composite_score, eligibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (tenant_id, student_id) DO UPDATE SET
         nps_score = $3, attendance_count = $4, retention_days = $5, referral_count = $6,
         has_recent_problem = $7, composite_score = $8, eligibility = $9, computed_at = now()`,
      [tenantId, s.student_id, s.nps_score, attendanceCount, retentionDays, referralCount, hasRecentProblem, score, eligibility],
    );

    if (!hasRecentProblem) {
      const distance = Math.min(
        Math.abs(score - THRESHOLDS.strong),
        Math.abs(score - THRESHOLDS.nurture),
        Math.abs(score - THRESHOLDS.wait),
      );
      if (!mostBorderline || distance < mostBorderline.distance) {
        mostBorderline = { studentId: s.student_id, score, distance, hasRecentProblem, eligibility };
      }
    }
  }

  console.log(`[advocacy-score] scored ${students.rowCount} active students`);

  if (mostBorderline && mostBorderline.distance <= 5) {
    try {
      const prompt = `Student advocacy composite score: ${mostBorderline.score}/92. Current eligibility bucket: ${mostBorderline.eligibility}. This score sits within 5 points of a threshold boundary.`;
      const raw = await ollama.generate(prompt, {
        tier: 'fast',
        system: 'You are a customer-advocacy analyst for a yoga studio. Given one real, already-computed composite eligibility score and its current bucket, write 1 sentence noting that this case is borderline and one concrete next step for staff. Only reason from the number and bucket given — do not invent a reason not implied by the data.',
        maxTokens: 150, timeoutMs: 45_000,
      });
      const note = extractText(raw);
      await db.query(
        `UPDATE advocacy_score SET ai_note = $1 WHERE tenant_id = $2 AND student_id = $3`,
        [note, tenantId, mostBorderline.studentId],
      );
    } catch (err) {
      console.error('[advocacy-score] borderline note failed:', err);
    }
  }
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container.
}
