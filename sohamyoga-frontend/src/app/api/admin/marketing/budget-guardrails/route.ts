import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Admin Portal -- Budget Guardrail Management. marketing_budget_guardrail
// (db-schema-advanced-operations.sql) had a real per-channel schema (daily/
// monthly limits, target CAC, minimum ROAS, auto-pause flag) but zero API
// route and zero admin UI anywhere -- pure dead schema since it was added.
// This is the config/rule layer only: there is no real ad-spend ingestion
// pipeline in this codebase yet, so auto-pause enforcement against actual
// spend is honestly out of scope until that exists -- not fabricated here.
const CHANNELS = ['google_ads', 'meta_ads', 'instagram', 'facebook', 'tiktok', 'linkedin', 'email', 'sms'];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const result = await query(
    `SELECT id, channel, daily_limit, monthly_limit, target_cac, minimum_roas,
            auto_pause_enabled, approval_threshold, currency, active, updated_at
     FROM marketing_budget_guardrail WHERE tenant_id = $1 ORDER BY channel`,
    [tenantId],
  );
  return Response.json({ guardrails: result.rows, channels: CHANNELS });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    channel?: string; dailyLimit?: number | null; monthlyLimit?: number | null;
    targetCac?: number | null; minimumRoas?: number | null;
    autoPauseEnabled?: boolean; approvalThreshold?: number | null; currency?: string; active?: boolean;
  } | null;
  if (!body?.channel || !CHANNELS.includes(body.channel)) {
    return Response.json({ error: 'A valid channel is required.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const result = await query(
    `INSERT INTO marketing_budget_guardrail
       (tenant_id, channel, daily_limit, monthly_limit, target_cac, minimum_roas, auto_pause_enabled, approval_threshold, currency, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'CAD'),COALESCE($10,true))
     ON CONFLICT (tenant_id, channel) DO UPDATE SET
       daily_limit = EXCLUDED.daily_limit, monthly_limit = EXCLUDED.monthly_limit,
       target_cac = EXCLUDED.target_cac, minimum_roas = EXCLUDED.minimum_roas,
       auto_pause_enabled = EXCLUDED.auto_pause_enabled, approval_threshold = EXCLUDED.approval_threshold,
       currency = EXCLUDED.currency, active = EXCLUDED.active, updated_at = now()
     RETURNING id, channel, daily_limit, monthly_limit, target_cac, minimum_roas, auto_pause_enabled, approval_threshold, currency, active, updated_at`,
    [tenantId, body.channel, body.dailyLimit ?? null, body.monthlyLimit ?? null, body.targetCac ?? null,
     body.minimumRoas ?? null, body.autoPauseEnabled ?? false, body.approvalThreshold ?? null, body.currency ?? null, body.active ?? null],
  );
  return Response.json({ guardrail: result.rows[0] });
}
