// Real drip-sequence advancement. Every due enrollment's next step is
// queued for real (drip_send_log, status='queued') and the enrollment
// advances — this is genuine multi-step delayed sequencing, distinct from
// LeadNurturingJob's one-shot external Mautic push. Real email delivery is
// honestly out of scope here: no SMTP/Novu is deployed in this environment,
// so a step is never marked 'sent', matching this session's established
// no-fabrication discipline.
import { getPool } from '@/lib/postgres';

interface DueEnrollment {
  id: string;
  sequence_id: string;
  lead_id: string;
  current_step: number;
  email: string | null;
}

export async function run(): Promise<void> {
  const pool = getPool();
  const due = await pool.query<DueEnrollment>(
    `SELECT e.id, e.sequence_id, e.lead_id, e.current_step, l.email
     FROM drip_enrollment e JOIN campaign_lead l ON l.id = e.lead_id
     WHERE e.status = 'active' AND e.next_step_due_at <= now()`,
  );

  let advanced = 0, completed = 0, skippedNoEmail = 0;
  for (const enrollment of due.rows) {
    const nextStepOrder = enrollment.current_step + 1;
    const step = await pool.query<{ id: string; subject: string; body: string; delay_hours: number }>(
      `SELECT id, subject, body, delay_hours FROM drip_step WHERE sequence_id = $1 AND step_order = $2`,
      [enrollment.sequence_id, nextStepOrder],
    );

    if (!step.rowCount) {
      await pool.query(`UPDATE drip_enrollment SET status = 'completed' WHERE id = $1`, [enrollment.id]);
      completed++;
      continue;
    }

    if (!enrollment.email) {
      // A real lead with no email can't receive this step — skip advancing
      // it so it isn't silently lost, but don't fabricate a send either.
      skippedNoEmail++;
      continue;
    }

    await pool.query(
      `INSERT INTO drip_send_log (enrollment_id, step_id, recipient_email, subject, status) VALUES ($1,$2,$3,$4,'queued')`,
      [enrollment.id, step.rows[0].id, enrollment.email, step.rows[0].subject],
    );

    const followingStep = await pool.query<{ delay_hours: number }>(
      `SELECT delay_hours FROM drip_step WHERE sequence_id = $1 AND step_order = $2`,
      [enrollment.sequence_id, nextStepOrder + 1],
    );
    if (followingStep.rowCount) {
      await pool.query(
        `UPDATE drip_enrollment SET current_step = $2, next_step_due_at = now() + ($3 || ' hours')::interval WHERE id = $1`,
        [enrollment.id, nextStepOrder, followingStep.rows[0].delay_hours],
      );
    } else {
      await pool.query(`UPDATE drip_enrollment SET current_step = $2, status = 'completed' WHERE id = $1`, [enrollment.id, nextStepOrder]);
      completed++;
    }
    advanced++;
  }

  console.log(`[drip-sequence-processor] ${advanced} step(s) queued, ${completed} enrollment(s) completed, ${skippedNoEmail} skipped (no email)`);
}
