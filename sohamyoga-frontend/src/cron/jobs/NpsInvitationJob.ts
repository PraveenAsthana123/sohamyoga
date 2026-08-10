// NpsInvitationJob — invites students to the post-class-experience NPS
// survey once a class they checked into has genuinely ended. There is no
// class_session.status transition to 'completed' anywhere in this codebase,
// so "ended" is computed directly from session_date+start_time+duration_
// minutes rather than trusting a status column nothing ever updates.
//
// survey_invitation has UNIQUE(survey_id, email) — one invitation per person
// per survey, ever (not per class) — so this only ever invites a student to
// this survey once, on their first eligible completed class.

import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sohamyoga.ca';
const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000';
// The seeded SohamYoga tenant row (tenant.slug = 'sohamyoga') — notification_queue.tenant_id
// is real multi-tenancy, not an actor marker; do not confuse with SYSTEM_ACTOR above.
const TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';
const BATCH_SIZE = 50;

interface EligibleRow {
  student_id: string; user_id: string; email: string; display_name: string; class_name: string;
}

export async function run(): Promise<void> {
  const survey = await db.query<{ id: string }>(`SELECT id FROM survey WHERE slug = 'post-class-experience' AND status = 'active'`);
  const surveyId = survey.rows[0]?.id;
  if (!surveyId) { console.log('[nps-invitation] post-class-experience survey not found/active — skipping'); return; }

  const eligible = await db.query<EligibleRow>(
    `SELECT s.id AS student_id, s.user_id, s.email, s.display_name, c.class_name
     FROM booking b
     JOIN class_session c ON c.id = b.class_session_id
     JOIN student s ON s.id = b.student_id
     WHERE b.status = 'checked_in'
       AND (c.session_date + c.start_time + (c.duration_minutes || ' minutes')::interval) < now()
       AND (c.session_date + c.start_time) > now() - INTERVAL '30 days'
       AND NOT EXISTS (
         SELECT 1 FROM survey_invitation i WHERE i.survey_id = $1 AND i.email = s.email
       )
     LIMIT $2`,
    [surveyId, BATCH_SIZE],
  );

  let invited = 0;
  for (const row of eligible.rows) {
    const token = randomUUID().replace(/-/g, '');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const invitation = await client.query(
        `INSERT INTO survey_invitation (survey_id, email, token, sent_by, expires_at)
         VALUES ($1,$2,$3,$4, now() + INTERVAL '14 days')
         ON CONFLICT (survey_id, email) DO NOTHING RETURNING id`,
        [surveyId, row.email, token, SYSTEM_ACTOR],
      );
      if (invitation.rows.length) {
        const surveyUrl = `${SITE_URL}/feedback/post-class-experience?token=${token}`;
        await client.query(
          `INSERT INTO notification_queue
             (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
           VALUES ($1,'nps_survey_invite','email','transactional',$2,$3,$4,$5)
           ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
          [TENANT_ID, row.user_id, row.email,
            JSON.stringify({ studentName: row.display_name, className: row.class_name, surveyUrl }),
            `nps-invite-${surveyId}-${row.student_id}`],
        );
        invited++;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[nps-invitation] failed for student=${row.student_id}:`, error);
    } finally {
      client.release();
    }
  }

  console.log(`[nps-invitation] eligible=${eligible.rows.length} invited=${invited}`);
  // Do NOT db.end() here — see NotificationRetryJob.ts.
}
