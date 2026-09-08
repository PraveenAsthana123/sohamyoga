import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { twoProportionZTest } from '@/domain/experimentation/Experiment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENT_TYPES = ['page_view', 'click', 'form_start', 'form_submit', 'download', 'booking_started', 'booking_completed', 'payment_initiated', 'payment_completed', 'subscription_started', 'error', 'scroll_depth', 'custom'];

// GET — list experiments with variant breakdown and LIVE conversion stats,
// joined against the real tracking_event table. No stored/fabricated lift
// numbers: every rate and significance test is computed fresh on each call.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const experiments = await query<{
    id: string; key: string; name: string; hypothesis: string | null; status: string;
    target_event_type: string; minimum_sample_size: number; started_at: string | null; ended_at: string | null; created_at: string;
  }>(`SELECT * FROM experiment WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);

  const results = await Promise.all(experiments.rows.map(async exp => {
    const variants = await query<{ id: string; key: string; name: string; allocation_percent: number; is_control: boolean }>(
      `SELECT id, key, name, allocation_percent, is_control FROM experiment_variant WHERE experiment_id = $1 ORDER BY key`,
      [exp.id],
    );
    const stats = await Promise.all(variants.rows.map(async v => {
      const assigned = await query<{ count: string }>(`SELECT count(*)::text FROM experiment_assignment WHERE variant_id = $1`, [v.id]);
      const converted = await query<{ count: string }>(
        `SELECT count(DISTINCT a.subject_id)::text FROM experiment_assignment a
         JOIN tracking_event e ON (e.anonymous_id = a.subject_id OR e.user_id = a.subject_id) AND e.created_at >= a.assigned_at
         WHERE a.variant_id = $1 AND e.event_type = $2`,
        [v.id, exp.target_event_type],
      );
      return { variantId: v.id, key: v.key, name: v.name, isControl: v.is_control, allocationPercent: v.allocation_percent, sampleSize: Number(assigned.rows[0].count), conversions: Number(converted.rows[0].count) };
    }));

    const control = stats.find(s => s.isControl);
    const withSignificance = stats.map(s => {
      if (!control || s.variantId === control.variantId || s.sampleSize === 0 || control.sampleSize === 0) {
        return { ...s, conversionRate: s.sampleSize ? s.conversions / s.sampleSize : null, vsControl: null };
      }
      const test = twoProportionZTest(control.conversions, control.sampleSize, s.conversions, s.sampleSize);
      return {
        ...s, conversionRate: s.conversions / s.sampleSize,
        vsControl: test ? { pValue: test.pValue, significant: test.pValue < 0.05, liftPercent: control.conversions / control.sampleSize > 0 ? ((s.conversions / s.sampleSize) / (control.conversions / control.sampleSize) - 1) * 100 : null } : { insufficientSample: true },
      };
    });

    return {
      id: exp.id, key: exp.key, name: exp.name, hypothesis: exp.hypothesis, status: exp.status,
      targetEventType: exp.target_event_type, minimumSampleSize: exp.minimum_sample_size,
      startedAt: exp.started_at, endedAt: exp.ended_at, createdAt: exp.created_at,
      variants: withSignificance,
      allocationTotal: variants.rows.reduce((n, v) => n + v.allocation_percent, 0),
    };
  }));

  return Response.json({ experiments: results, eventTypes: EVENT_TYPES });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as Record<string, any> | null;
  if (!body?.action) return Response.json({ error: 'action is required.' }, { status: 400 });
  const tenantId = await getPrimaryTenantId();

  if (body.action === 'create_experiment') {
    if (!body.key || !body.name || !EVENT_TYPES.includes(body.targetEventType)) {
      return Response.json({ error: `key, name and a valid targetEventType (${EVENT_TYPES.join('|')}) are required.` }, { status: 400 });
    }
    const r = await query(
      `INSERT INTO experiment (tenant_id, key, name, hypothesis, target_event_type, minimum_sample_size) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, body.key, body.name, body.hypothesis || null, body.targetEventType, body.minimumSampleSize || 100],
    );
    return Response.json({ experiment: r.rows[0] }, { status: 201 });
  }

  if (body.action === 'add_variant') {
    if (!body.experimentId || !body.key || !body.name || !(body.allocationPercent > 0)) {
      return Response.json({ error: 'experimentId, key, name and a positive allocationPercent are required.' }, { status: 400 });
    }
    const exp = await query<{ status: string }>(`SELECT status FROM experiment WHERE id = $1 AND tenant_id = $2`, [body.experimentId, tenantId]);
    if (!exp.rowCount) return Response.json({ error: 'Experiment not found.' }, { status: 404 });
    if (exp.rows[0].status !== 'draft') return Response.json({ error: 'Variants can only be added while the experiment is in draft.' }, { status: 409 });
    const existing = await query<{ total: string }>(`SELECT coalesce(sum(allocation_percent),0)::text AS total FROM experiment_variant WHERE experiment_id = $1`, [body.experimentId]);
    if (Number(existing.rows[0].total) + Number(body.allocationPercent) > 100) {
      return Response.json({ error: `Allocation would exceed 100% (currently ${existing.rows[0].total}%).` }, { status: 409 });
    }
    const r = await query(
      `INSERT INTO experiment_variant (experiment_id, key, name, allocation_percent, is_control) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [body.experimentId, body.key, body.name, body.allocationPercent, Boolean(body.isControl)],
    );
    return Response.json({ variant: r.rows[0] }, { status: 201 });
  }

  if (body.action === 'start_experiment') {
    const exp = await query<{ status: string }>(`SELECT status FROM experiment WHERE id = $1 AND tenant_id = $2`, [body.experimentId, tenantId]);
    if (!exp.rowCount) return Response.json({ error: 'Experiment not found.' }, { status: 404 });
    if (exp.rows[0].status !== 'draft') return Response.json({ error: 'Only a draft experiment can be started.' }, { status: 409 });
    const variants = await query<{ id: string; allocation_percent: number; is_control: boolean }>(`SELECT id, allocation_percent, is_control FROM experiment_variant WHERE experiment_id = $1`, [body.experimentId]);
    const total = variants.rows.reduce((n, v) => n + v.allocation_percent, 0);
    if (variants.rows.length < 2) return Response.json({ error: 'At least 2 variants (1 control + 1 treatment) are required to start.' }, { status: 409 });
    if (total !== 100) return Response.json({ error: `Variant allocations must sum to exactly 100% (currently ${total}%).` }, { status: 409 });
    if (!variants.rows.some(v => v.is_control)) return Response.json({ error: 'One variant must be marked as control.' }, { status: 409 });
    const r = await query(`UPDATE experiment SET status='running', started_at=now(), updated_at=now() WHERE id=$1 RETURNING *`, [body.experimentId]);
    return Response.json({ experiment: r.rows[0] });
  }

  if (body.action === 'stop_experiment') {
    const r = await query(`UPDATE experiment SET status='completed', ended_at=now(), updated_at=now() WHERE id=$1 AND tenant_id=$2 AND status='running' RETURNING *`, [body.experimentId, tenantId]);
    if (!r.rowCount) return Response.json({ error: 'No running experiment found with that id.' }, { status: 409 });
    return Response.json({ experiment: r.rows[0] });
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
