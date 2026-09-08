import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Customer Onboarding Wizard -- confirmed zero implementation before this
// (grep, 2026-09-01): a new customer landed on their dashboard with
// goal_statement/preferred_class_styles/preferred_class_times unset and no
// guided setup. Writes into the real, pre-existing customer + health_profile
// tables -- no parallel data model, so nothing here is throwaway wizard state.
async function resolveCustomerId(req: NextRequest): Promise<string | null> {
  const { principal } = await getCustomerPrincipal(req);
  const result = await query<{ id: string }>(`SELECT id FROM customer WHERE user_id = $1`, [principal!.id]);
  return result.rows[0]?.id ?? null;
}

export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const customerId = await resolveCustomerId(req);
  if (!customerId) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const customer = await query<{ onboarding_step: string; onboarding_completed_at: string | null; goal_statement: string; preferred_class_styles: string[]; preferred_class_times: string[] }>(
    `SELECT onboarding_step, onboarding_completed_at, goal_statement, preferred_class_styles, preferred_class_times FROM customer WHERE id = $1`,
    [customerId],
  );
  const health = await query(`SELECT fitness_level, conditions FROM health_profile WHERE customer_id = $1`, [customerId]);

  return Response.json({ ...customer.rows[0], healthProfile: health.rows[0] ?? null });
}

const STEP_ORDER = ['goals', 'schedule', 'health', 'notifications', 'done'] as const;

export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const customerId = await resolveCustomerId(req);
  if (!customerId) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const body = await req.json();
  const { step } = body;
  if (!STEP_ORDER.includes(step)) return Response.json({ error: `step must be one of: ${STEP_ORDER.join(', ')}` }, { status: 400 });

  if (step === 'goals') {
    await query(
      `UPDATE customer SET goal_statement = $2, onboarding_step = 'schedule' WHERE id = $1`,
      [customerId, body.goalStatement ?? ''],
    );
  } else if (step === 'schedule') {
    await query(
      `UPDATE customer SET preferred_class_styles = $2, preferred_class_times = $3, onboarding_step = 'health' WHERE id = $1`,
      [customerId, body.preferredClassStyles ?? [], body.preferredClassTimes ?? []],
    );
  } else if (step === 'health') {
    const tenantId = await getPrimaryTenantId();
    await query(
      `INSERT INTO health_profile (tenant_id, customer_id, fitness_level, conditions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, customer_id) DO UPDATE SET fitness_level = EXCLUDED.fitness_level, conditions = EXCLUDED.conditions, updated_at = now()`,
      [tenantId, customerId, body.fitnessLevel ?? 'moderate', body.conditions ?? []],
    );
    await query(`UPDATE customer SET onboarding_step = 'notifications' WHERE id = $1`, [customerId]);
  } else if (step === 'notifications') {
    await query(
      `UPDATE customer SET reminder_minutes_before = $2, email_opt_in = $3, sms_opt_in = $4, onboarding_step = 'done', onboarding_completed_at = now() WHERE id = $1`,
      [customerId, body.reminderMinutesBefore ?? 30, body.emailOptIn ?? false, body.smsOptIn ?? false],
    );
  }

  return Response.json({ ok: true });
}
