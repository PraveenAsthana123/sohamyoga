import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const result = await query(
      `SELECT * FROM acquisition_channels ORDER BY leads_generated_30d DESC`
    );
    return Response.json({ channels: result.rows });
  } catch (err) {
    console.error('[channels] GET error:', err);
    return Response.json({ error: 'Failed to load channels.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { channel_name, status, monthly_budget_cad, notes, attribution_model } = body as Record<string, unknown>;

    if (!channel_name || typeof channel_name !== 'string') {
      return Response.json({ error: 'channel_name is required.' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO acquisition_channels (channel_name, status, monthly_budget_cad, attribution_model, notes)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        channel_name,
        status ?? 'active',
        monthly_budget_cad ? Number(monthly_budget_cad) : 0,
        attribution_model ?? 'last_click',
        notes ?? null,
      ]
    );

    return Response.json({ ok: true, channel: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[channels] POST error:', err);
    return Response.json({ error: 'Failed to create channel.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { id, monthly_spend_cad, leads_generated_30d, conversions, status, monthly_budget_cad, attribution_model, notes } = body as Record<string, unknown>;

    if (!id || typeof id !== 'string') {
      return Response.json({ error: 'id is required.' }, { status: 400 });
    }

    const current = await query(`SELECT * FROM acquisition_channels WHERE id = $1`, [id]);
    if (!current.rowCount) {
      return Response.json({ error: 'Channel not found.' }, { status: 404 });
    }

    const row = current.rows[0] as Record<string, unknown>;

    const newSpend = monthly_spend_cad !== undefined ? Number(monthly_spend_cad) : Number(row.monthly_spend_cad);
    const newLeads = leads_generated_30d !== undefined ? Number(leads_generated_30d) : Number(row.leads_generated_30d);
    const newBudget = monthly_budget_cad !== undefined ? Number(monthly_budget_cad) : Number(row.monthly_budget_cad);
    const newConv = conversions !== undefined ? Number(conversions) : Number(row.conversions ?? 0);

    const cpl = newLeads > 0 ? newSpend / newLeads : null;
    const convRate = newLeads > 0 ? newConv / newLeads : null;
    const roi = newSpend > 0 ? (newConv * (newBudget / (newLeads || 1))) / newSpend : null;

    const result = await query(
      `UPDATE acquisition_channels
       SET monthly_spend_cad=$2, leads_generated_30d=$3, cost_per_lead=$4,
           conversion_rate=$5, roi=$6, monthly_budget_cad=$7,
           status=COALESCE($8, status),
           attribution_model=COALESCE($9, attribution_model),
           notes=COALESCE($10, notes)
       WHERE id=$1
       RETURNING *`,
      [id, newSpend, newLeads, cpl, convRate, roi, newBudget,
       status ?? null, attribution_model ?? null, notes ?? null]
    );

    return Response.json({ ok: true, channel: result.rows[0] });
  } catch (err) {
    console.error('[channels] PATCH error:', err);
    return Response.json({ error: 'Failed to update channel.' }, { status: 500 });
  }
}
