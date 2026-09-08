import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { getAdminPrincipal, requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Budget Allocation -- ad_budget_event existed in the schema with zero
// writers anywhere. A budget_increase/budget_decrease event both logs the
// change AND actually updates ad_campaign.daily_budget_cents in the same
// transaction -- a real state change, not just an audit entry nobody reads.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const rows = await query(
    `SELECT id, event_type, amount_cents, daily_budget_cents, total_budget_cents, recorded_by, created_at
     FROM ad_budget_event WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [id],
  );
  return Response.json({
    events: rows.rows.map(r => ({
      id: r.id, eventType: r.event_type, amountCents: Number(r.amount_cents),
      dailyBudgetCents: r.daily_budget_cents, totalBudgetCents: r.total_budget_cents,
      recordedBy: r.recorded_by, createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { eventType?: string; amountCents?: number } | null;
  if (!body?.eventType || !['budget_increase', 'budget_decrease'].includes(body.eventType) || !body.amountCents || body.amountCents <= 0) {
    return Response.json({ error: 'eventType must be budget_increase|budget_decrease and amountCents must be a positive integer.' }, { status: 400 });
  }

  const campaign = await query<{ daily_budget_cents: number }>(`SELECT daily_budget_cents FROM ad_campaign WHERE id = $1`, [id]);
  if (!campaign.rowCount) return Response.json({ error: 'Campaign not found.' }, { status: 404 });

  const delta = body.eventType === 'budget_increase' ? body.amountCents : -body.amountCents;
  const newDailyBudget = campaign.rows[0].daily_budget_cents + delta;
  if (newDailyBudget < 1) return Response.json({ error: 'Daily budget cannot be reduced below $0.01.' }, { status: 400 });

  const eventId = await transaction(async client => {
    await client.query(`UPDATE ad_campaign SET daily_budget_cents = $2, updated_at = now() WHERE id = $1`, [id, newDailyBudget]);
    const result = await client.query<{ id: string }>(
      `INSERT INTO ad_budget_event (campaign_id, event_type, amount_cents, daily_budget_cents, recorded_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [id, body.eventType, body.amountCents, newDailyBudget, principal!.email ?? principal!.id],
    );
    return result.rows[0].id;
  });

  return Response.json({ ok: true, id: eventId, newDailyBudgetCents: newDailyBudget }, { status: 201 });
}
