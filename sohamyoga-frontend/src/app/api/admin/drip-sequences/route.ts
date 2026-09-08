import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const sequences = await query(`SELECT * FROM drip_sequence ORDER BY created_at DESC`);
  const steps = await query(`SELECT * FROM drip_step ORDER BY sequence_id, step_order`);
  const enrollments = await query(
    `SELECT e.*, l.email, l.first_name, l.last_name FROM drip_enrollment e JOIN campaign_lead l ON l.id = e.lead_id ORDER BY e.enrolled_at DESC LIMIT 100`,
  );
  const sendLog = await query(`SELECT * FROM drip_send_log ORDER BY queued_at DESC LIMIT 100`);
  return Response.json({ sequences: sequences.rows, steps: steps.rows, enrollments: enrollments.rows, sendLog: sendLog.rows });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as Record<string, any> | null;
  if (!body?.action) return Response.json({ error: 'action is required.' }, { status: 400 });
  const tenantId = await getPrimaryTenantId();

  if (body.action === 'create_sequence') {
    if (!body.name) return Response.json({ error: 'name is required.' }, { status: 400 });
    const r = await query(`INSERT INTO drip_sequence (tenant_id, name, description) VALUES ($1,$2,$3) RETURNING *`, [tenantId, body.name, body.description || '']);
    return Response.json({ sequence: r.rows[0] }, { status: 201 });
  }

  if (body.action === 'add_step') {
    if (!body.sequenceId || !body.subject || !body.body || body.delayHours === undefined) {
      return Response.json({ error: 'sequenceId, subject, body, and delayHours are required.' }, { status: 400 });
    }
    const existing = await query<{ max: number | null }>(`SELECT max(step_order) AS max FROM drip_step WHERE sequence_id = $1`, [body.sequenceId]);
    const nextOrder = (existing.rows[0].max ?? 0) + 1;
    const r = await query(
      `INSERT INTO drip_step (sequence_id, step_order, delay_hours, subject, body) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [body.sequenceId, nextOrder, body.delayHours, body.subject, body.body],
    );
    return Response.json({ step: r.rows[0] }, { status: 201 });
  }

  if (body.action === 'activate_sequence') {
    if (!body.sequenceId) return Response.json({ error: 'sequenceId is required.' }, { status: 400 });
    const stepCount = await query<{ count: string }>(`SELECT count(*)::text FROM drip_step WHERE sequence_id = $1`, [body.sequenceId]);
    if (Number(stepCount.rows[0].count) === 0) return Response.json({ error: 'A sequence needs at least 1 step before it can be activated.' }, { status: 409 });
    const r = await query(`UPDATE drip_sequence SET status = 'active' WHERE id = $1 RETURNING *`, [body.sequenceId]);
    return Response.json({ sequence: r.rows[0] });
  }

  if (body.action === 'enroll_lead') {
    if (!body.sequenceId || !body.leadId) return Response.json({ error: 'sequenceId and leadId are required.' }, { status: 400 });
    const seq = await query<{ status: string }>(`SELECT status FROM drip_sequence WHERE id = $1`, [body.sequenceId]);
    if (!seq.rowCount) return Response.json({ error: 'Sequence not found.' }, { status: 404 });
    if (seq.rows[0].status !== 'active') return Response.json({ error: 'Only an active sequence can enroll leads.' }, { status: 409 });
    const firstStep = await query<{ delay_hours: number }>(`SELECT delay_hours FROM drip_step WHERE sequence_id = $1 AND step_order = 1`, [body.sequenceId]);
    if (!firstStep.rowCount) return Response.json({ error: 'Sequence has no step 1.' }, { status: 409 });
    try {
      const r = await query(
        `INSERT INTO drip_enrollment (sequence_id, lead_id, next_step_due_at) VALUES ($1,$2, now() + ($3 || ' hours')::interval) RETURNING *`,
        [body.sequenceId, body.leadId, firstStep.rows[0].delay_hours],
      );
      return Response.json({ enrollment: r.rows[0] }, { status: 201 });
    } catch (err) {
      return Response.json({ error: err instanceof Error && err.message.includes('duplicate') ? 'This lead is already enrolled in this sequence.' : 'Enrollment failed.' }, { status: 409 });
    }
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
