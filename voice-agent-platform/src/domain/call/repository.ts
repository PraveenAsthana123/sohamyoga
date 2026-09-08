import { query } from '@/lib/db';
import { CallLog, CallLogProps, CallDirection, CallStatus } from './CallLog';

interface CallLogRow {
  id: string;
  direction: CallDirection;
  contact_id: string | null;
  script_version_id: string | null;
  status: CallStatus;
  duration_seconds: number | null;
  started_at: Date | null;
  ended_at: Date | null;
  outcome_notes: string | null;
  provider: string;
  created_by: string;
  created_at: Date;
  external_call_id: string | null;
  needs_follow_up: boolean;
  cost_usd: string | null;
  transcript: string | null;
  recording_url: string | null;
  ended_reason: string | null;
  quality_score: number | null;
  is_incident: boolean;
  incident_notes: string | null;
}

function toEntity(row: CallLogRow): CallLog {
  const props: CallLogProps = {
    id: row.id,
    direction: row.direction,
    contactId: row.contact_id,
    scriptVersionId: row.script_version_id,
    status: row.status,
    durationSeconds: row.duration_seconds,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    endedAt: row.ended_at ? new Date(row.ended_at) : null,
    outcomeNotes: row.outcome_notes,
    provider: row.provider,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    externalCallId: row.external_call_id,
    needsFollowUp: row.needs_follow_up,
    costUsd: row.cost_usd !== null ? Number(row.cost_usd) : null,
    transcript: row.transcript,
    recordingUrl: row.recording_url,
    endedReason: row.ended_reason,
    qualityScore: row.quality_score,
    isIncident: row.is_incident,
    incidentNotes: row.incident_notes,
  };
  return new CallLog(props);
}

export interface CallLogListRow extends CallLogProps {
  contactName: string | null;
  scriptName: string | null;
}

export async function listCalls(limit = 200): Promise<CallLogListRow[]> {
  const { rows } = await query<
    CallLogRow & { contact_name: string | null; script_name: string | null }
  >(
    `SELECT cl.*, c.full_name AS contact_name, cs.name AS script_name
       FROM call_log cl
       LEFT JOIN contact c ON c.id = cl.contact_id
       LEFT JOIN call_script_version csv ON csv.id = cl.script_version_id
       LEFT JOIN call_script cs ON cs.id = csv.script_id
      ORDER BY cl.created_at DESC
      LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({ ...toEntity(row).toJSON(), contactName: row.contact_name, scriptName: row.script_name }));
}

export async function getCall(id: string): Promise<CallLog | null> {
  const { rows } = await query<CallLogRow>('SELECT * FROM call_log WHERE id = $1', [id]);
  return rows[0] ? toEntity(rows[0]) : null;
}

export interface CreateCallInput {
  direction: CallDirection;
  contactId?: string | null;
  scriptVersionId?: string | null;
  status: CallStatus;
  durationSeconds?: number | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  outcomeNotes?: string | null;
  provider?: string;
  createdBy?: string;
  externalCallId?: string | null;
  needsFollowUp?: boolean;
}

/** Records a call outcome — either a manual entry, or the result of a real
 * placeCall() (see VapiCallAdapter), distinguished by `provider`/`externalCallId`. */
export async function createManualCall(input: CreateCallInput): Promise<CallLog> {
  // Validate shape via the entity first.
  new CallLog({
    id: '00000000-0000-0000-0000-000000000000',
    direction: input.direction,
    contactId: input.contactId ?? null,
    scriptVersionId: input.scriptVersionId ?? null,
    status: input.status,
    durationSeconds: input.durationSeconds ?? null,
    startedAt: input.startedAt ?? null,
    endedAt: input.endedAt ?? null,
    outcomeNotes: input.outcomeNotes ?? null,
    provider: input.provider ?? 'manual',
    createdBy: input.createdBy ?? 'admin',
    createdAt: new Date(),
    externalCallId: input.externalCallId ?? null,
    needsFollowUp: input.needsFollowUp ?? false,
    costUsd: null,
    transcript: null,
    recordingUrl: null,
    endedReason: null,
    qualityScore: null,
    isIncident: false,
    incidentNotes: null,
  });

  const { rows } = await query<CallLogRow>(
    `INSERT INTO call_log
       (direction, contact_id, script_version_id, status, duration_seconds, started_at, ended_at, outcome_notes, provider, created_by, external_call_id, needs_follow_up)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      input.direction,
      input.contactId ?? null,
      input.scriptVersionId ?? null,
      input.status,
      input.durationSeconds ?? null,
      input.startedAt ?? null,
      input.endedAt ?? null,
      input.outcomeNotes ?? null,
      input.provider ?? 'manual',
      input.createdBy ?? 'admin',
      input.externalCallId ?? null,
      input.needsFollowUp ?? false,
    ]
  );
  return toEntity(rows[0]);
}

export async function countCalls(): Promise<number> {
  const { rows } = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM call_log');
  return Number(rows[0]?.count ?? 0);
}

/** Sums only real webhook-reported costs -- NULL for every call that hasn't
 * had its outcome reported yet, so this is never an estimate. */
export async function totalCallCostUsd(): Promise<number> {
  const { rows } = await query<{ total: string | null }>('SELECT SUM(cost_usd)::text AS total FROM call_log');
  return rows[0]?.total ? Number(rows[0].total) : 0;
}

/** Human QA review -- admin-entered only, never fabricated. */
export async function setCallQualityReview(id: string, review: { qualityScore: number | null; isIncident: boolean; incidentNotes: string | null }): Promise<CallLog> {
  const { rows } = await query<CallLogRow>(
    `UPDATE call_log SET quality_score = $2, is_incident = $3, incident_notes = $4 WHERE id = $1 RETURNING *`,
    [id, review.qualityScore, review.isIncident, review.incidentNotes]
  );
  return toEntity(rows[0]);
}

export interface QualityReportRow {
  scriptName: string | null;
  avgQualityScore: number | null;
  incidentCount: number;
  totalCalls: number;
}

/** Real "quality matrix" (Topic I) -- per-script average of REAL human QA
 * scores plus a real incident count. NULL average means no calls have been
 * reviewed yet, not a zero score. */
export async function qualityMatrixByScript(): Promise<QualityReportRow[]> {
  const { rows } = await query<{ script_name: string | null; avg_quality: string | null; incident_count: string; total_calls: string }>(
    `SELECT cs.name AS script_name,
            AVG(cl.quality_score)::text AS avg_quality,
            COUNT(*) FILTER (WHERE cl.is_incident)::text AS incident_count,
            COUNT(*)::text AS total_calls
       FROM call_log cl
       LEFT JOIN call_script_version csv ON csv.id = cl.script_version_id
       LEFT JOIN call_script cs ON cs.id = csv.script_id
      GROUP BY cs.name
      ORDER BY cs.name NULLS LAST`
  );
  return rows.map((r) => ({
    scriptName: r.script_name,
    avgQualityScore: r.avg_quality ? Number(r.avg_quality) : null,
    incidentCount: Number(r.incident_count),
    totalCalls: Number(r.total_calls),
  }));
}

export interface CallsPerDayRow {
  day: string;
  count: number;
}

export async function callsPerDay(days = 14): Promise<CallsPerDayRow[]> {
  const { rows } = await query<{ day: string; count: string }>(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::text AS count
       FROM call_log
      WHERE created_at >= now() - ($1 || ' days')::interval
      GROUP BY 1
      ORDER BY 1`,
    [days]
  );
  return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
}

export interface CallsByStatusRow {
  status: CallStatus;
  count: number;
}

export async function callsByStatus(): Promise<CallsByStatusRow[]> {
  const { rows } = await query<{ status: CallStatus; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM call_log GROUP BY status ORDER BY status`
  );
  return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
}

export interface VapiApiHealthRow {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  blockedCount: number;
  avgDurationMs: number | null;
}

/** Real "Ops Control Tower" health section (Topics K/L), derived ONLY from
 * vapi_api_audit_log rows this app itself wrote -- no fabricated uptime/SLA
 * numbers. blockedCount > 0 would mean the tenant-isolation guard actually
 * refused a real request -- worth surfacing prominently if it ever happens. */
export async function vapiApiHealthLast7Days(): Promise<VapiApiHealthRow> {
  const { rows } = await query<{ total: string; success: string; failure: string; blocked: string; avg_ms: string | null }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE success = TRUE)::text AS success,
            COUNT(*) FILTER (WHERE success = FALSE)::text AS failure,
            COUNT(*) FILTER (WHERE blocked = TRUE)::text AS blocked,
            AVG(duration_ms)::text AS avg_ms
       FROM vapi_api_audit_log
      WHERE created_at >= now() - interval '7 days'`
  );
  const r = rows[0];
  return {
    totalCalls: Number(r?.total ?? 0),
    successCount: Number(r?.success ?? 0),
    failureCount: Number(r?.failure ?? 0),
    blockedCount: Number(r?.blocked ?? 0),
    avgDurationMs: r?.avg_ms ? Number(r.avg_ms) : null,
  };
}

/** Used by the Vapi webhook receiver to find the call_log row a real
 * end-of-call-report belongs to (set at placeCall() time for outbound). */
/** Applied by the webhook's `status-update` handler -- lets a real call show
 * 'in_progress' while it's actually happening, instead of sitting at
 * 'queued' for its whole duration until the final end-of-call-report. Only
 * updates status (never duration/cost/transcript -- those are only ever
 * set by the authoritative end-of-call-report). */
export async function updateCallStatusByExternalId(externalCallId: string, status: CallStatus): Promise<CallLog | null> {
  const { rows } = await query<CallLogRow>(
    `UPDATE call_log SET status = $2 WHERE external_call_id = $1 AND status != 'completed' AND status != 'failed' RETURNING *`,
    [externalCallId, status]
  );
  return rows[0] ? toEntity(rows[0]) : null;
}

export async function getCallByExternalId(externalCallId: string): Promise<CallLog | null> {
  const { rows } = await query<CallLogRow>('SELECT * FROM call_log WHERE external_call_id = $1', [externalCallId]);
  return rows[0] ? toEntity(rows[0]) : null;
}

export interface WebhookReport {
  status: CallStatus;
  durationSeconds: number | null;
  costUsd: number | null;
  transcript: string | null;
  recordingUrl: string | null;
  endedReason: string | null;
  startedAt: Date | null;
  endedAt: Date;
}

/** Updates an existing call_log row (outbound, placed via placeCall) with
 * the real reported outcome. */
export async function applyWebhookReportToCall(id: string, report: WebhookReport): Promise<CallLog> {
  const { rows } = await query<CallLogRow>(
    `UPDATE call_log SET
       status = $2, duration_seconds = $3, cost_usd = $4, transcript = $5,
       recording_url = $6, ended_reason = $7, started_at = COALESCE(started_at, $8), ended_at = $9
     WHERE id = $1
     RETURNING *`,
    [id, report.status, report.durationSeconds, report.costUsd, report.transcript,
      report.recordingUrl, report.endedReason, report.startedAt, report.endedAt]
  );
  return toEntity(rows[0]);
}

/** Creates a new call_log row for a real inbound call the webhook reported,
 * which never went through placeCall() so no prior row exists. */
export async function createInboundCallFromWebhook(input: {
  externalCallId: string;
  contactId: string | null;
  report: WebhookReport;
}): Promise<CallLog> {
  const { rows } = await query<CallLogRow>(
    `INSERT INTO call_log
       (direction, contact_id, status, duration_seconds, started_at, ended_at, provider, created_by,
        external_call_id, cost_usd, transcript, recording_url, ended_reason)
     VALUES ('inbound', $1, $2, $3, $4, $5, 'vapi', 'webhook', $6, $7, $8, $9, $10)
     RETURNING *`,
    [input.contactId, input.report.status, input.report.durationSeconds, input.report.startedAt,
      input.report.endedAt, input.externalCallId, input.report.costUsd, input.report.transcript,
      input.report.recordingUrl, input.report.endedReason]
  );
  return toEntity(rows[0]);
}
