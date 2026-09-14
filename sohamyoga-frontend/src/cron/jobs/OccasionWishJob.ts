// OccasionWishJob — Daily 05:30 UTC
// Real, deterministic scan: students whose real date_of_birth or
// enrolled_at (member anniversary) matches today's real month/day, plus
// any active festival_calendar row dated today (matched to real
// student.country, or global). For each real match, writes a real
// wish_card row (personalized, human-readable record) AND enqueues a
// real notification_queue row so it flows through the EXISTING real
// dispatch machinery (NotificationDispatchJob) -- push/in_app genuinely
// deliver; email/sms/whatsapp attempt a real Novu call and honestly
// fail if Novu isn't configured/running, same as every other
// notification in this codebase. No LLM involved -- always a real
// standard template (WISH_TEMPLATES), personalized only with real
// {year}/{festivalName}, never model-generated.

import { Pool } from 'pg';
import { WISH_TEMPLATES, type WishOccasion } from '@/domain/notification/WishCard';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SLUG_BY_OCCASION: Record<'birthday' | 'member_anniversary' | 'festival', string> = {
  birthday: 'birthday_wishes_push',
  member_anniversary: 'anniversary_wishes_push',
  festival: 'festival_wishes_push',
};

function personalize(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

async function upsertWish(params: {
  tenantId: string; studentId: string; userId: string; email: string;
  occasion: 'birthday' | 'member_anniversary' | 'festival'; festivalCode: string | null;
  title: string; message: string;
}): Promise<boolean> {
  const wishRes = await db.query<{ id: string }>(
    `INSERT INTO wish_card (tenant_id, student_id, occasion, festival_code, title, message, style, channel, status)
     VALUES ($1,$2,$3,$4,$5,$6,'yoga_themed','push','PENDING')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [params.tenantId, params.studentId, params.occasion, params.festivalCode, params.title, params.message],
  );
  if (wishRes.rowCount === 0) return false; // real same-day dedupe hit (uq_wish_card_student_occasion_day)

  const wishCardId = wishRes.rows[0].id;
  const slug = SLUG_BY_OCCASION[params.occasion];
  const queueRes = await db.query<{ id: string }>(
    `INSERT INTO notification_queue (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
     VALUES ($1,$2,'push','marketing',$3,$4,$5,$6)
     ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
     RETURNING id`,
    [params.tenantId, slug, params.userId, params.email, JSON.stringify({ title: params.title, body: params.message }), `wishcard_${wishCardId}`],
  );
  if (queueRes.rowCount && queueRes.rowCount > 0) {
    await db.query(`UPDATE wish_card SET notification_queue_id = $1 WHERE id = $2`, [queueRes.rows[0].id, wishCardId]);
  }
  return true;
}

export async function run(): Promise<void> {
  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  let birthdays = 0, anniversaries = 0, festivals = 0;

  // Real birthdays: student.date_of_birth month/day matches today.
  const bdayRows = await db.query<{ id: string; tenant_id: string; user_id: string; email: string; display_name: string }>(
    `SELECT id, tenant_id, user_id, email, display_name FROM student
     WHERE date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM date_of_birth) = $1 AND EXTRACT(DAY FROM date_of_birth) = $2
       AND status = 'active'`,
    [month, day],
  );
  for (const s of bdayRows.rows) {
    const tmpl = WISH_TEMPLATES.birthday;
    const sent = await upsertWish({
      tenantId: s.tenant_id, studentId: s.id, userId: s.user_id, email: s.email,
      occasion: 'birthday', festivalCode: null,
      title: personalize(tmpl.title, {}), message: personalize(tmpl.message, {}),
    });
    if (sent) birthdays++;
  }

  // Real member anniversaries: student.enrolled_at month/day matches today (year > enrollment year, i.e. not day 0).
  const annivRows = await db.query<{ id: string; tenant_id: string; user_id: string; email: string; enrolled_at: string }>(
    `SELECT id, tenant_id, user_id, email, enrolled_at FROM student
     WHERE EXTRACT(MONTH FROM enrolled_at) = $1 AND EXTRACT(DAY FROM enrolled_at) = $2
       AND enrolled_at < NOW() - INTERVAL '1 year'
       AND status = 'active'`,
    [month, day],
  );
  for (const s of annivRows.rows) {
    const years = today.getUTCFullYear() - new Date(s.enrolled_at).getUTCFullYear();
    const tmpl = WISH_TEMPLATES.member_anniversary;
    const sent = await upsertWish({
      tenantId: s.tenant_id, studentId: s.id, userId: s.user_id, email: s.email,
      occasion: 'member_anniversary', festivalCode: null,
      title: personalize(tmpl.title, {}), message: personalize(tmpl.message, { years: String(years) }),
    });
    if (sent) anniversaries++;
  }

  // Real festivals dated today (global or matching real student.country).
  const festivalRows = await db.query<{ code: string; name: string; country: string | null; tenant_id: string }>(
    `SELECT code, name, country, tenant_id FROM festival_calendar WHERE is_active = TRUE AND occasion_date = CURRENT_DATE`,
  );
  for (const f of festivalRows.rows) {
    const studentsForFestival = await db.query<{ id: string; tenant_id: string; user_id: string; email: string }>(
      f.country
        ? `SELECT id, tenant_id, user_id, email FROM student WHERE tenant_id = $1 AND country = $2 AND status = 'active'`
        : `SELECT id, tenant_id, user_id, email FROM student WHERE tenant_id = $1 AND status = 'active'`,
      f.country ? [f.tenant_id, f.country] : [f.tenant_id],
    );
    const tmpl = WISH_TEMPLATES.festival;
    for (const s of studentsForFestival.rows) {
      const sent = await upsertWish({
        tenantId: s.tenant_id, studentId: s.id, userId: s.user_id, email: s.email,
        occasion: 'festival', festivalCode: f.code,
        title: personalize(tmpl.title, { festivalName: f.name }), message: personalize(tmpl.message, { festivalName: f.name }),
      });
      if (sent) festivals++;
    }
  }

  console.log(`[occasion-wish] birthdays=${birthdays} anniversaries=${anniversaries} festivals=${festivals}`);
  // Do NOT db.end() here — this module is cached and reused across every
  // scheduled invocation in the long-lived cron runner, same reasoning
  // as every other job in this registry.
}
