import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real preferences persistence -- replaces a page that previously only held
// local useState and showed a fake "Saved" toast with a TODO comment for the
// POST that never existed.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const result = await query(
    `SELECT preferred_class_styles, preferred_class_times, reminder_minutes_before, goal_statement, email_opt_in, sms_opt_in
     FROM customer WHERE user_id = $1`,
    [principal!.id],
  );
  if (!result.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });
  return Response.json({ preferences: result.rows[0] });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    preferredClassStyles?: string[]; preferredClassTimes?: string[]; reminderMinutesBefore?: number;
    goalStatement?: string; emailOptIn?: boolean; smsOptIn?: boolean;
  } | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  if (body.reminderMinutesBefore !== undefined && ![0, 15, 30, 60].includes(body.reminderMinutesBefore)) {
    return Response.json({ error: 'reminderMinutesBefore must be one of 0, 15, 30, 60.' }, { status: 400 });
  }

  const { principal } = await getCustomerPrincipal(req);
  const result = await query(
    `UPDATE customer SET
       preferred_class_styles = COALESCE($2, preferred_class_styles),
       preferred_class_times = COALESCE($3, preferred_class_times),
       reminder_minutes_before = COALESCE($4, reminder_minutes_before),
       goal_statement = COALESCE($5, goal_statement),
       email_opt_in = COALESCE($6, email_opt_in),
       sms_opt_in = COALESCE($7, sms_opt_in),
       consent_updated_at = CASE WHEN $6 IS NOT NULL OR $7 IS NOT NULL THEN now() ELSE consent_updated_at END,
       updated_at = now()
     WHERE user_id = $1
     RETURNING preferred_class_styles, preferred_class_times, reminder_minutes_before, goal_statement, email_opt_in, sms_opt_in`,
    [principal!.id, body.preferredClassStyles ?? null, body.preferredClassTimes ?? null, body.reminderMinutesBefore ?? null,
      body.goalStatement ?? null, body.emailOptIn ?? null, body.smsOptIn ?? null],
  );
  if (!result.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });
  return Response.json({ preferences: result.rows[0] });
}
