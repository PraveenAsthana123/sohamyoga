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
}

/** Records a call outcome — currently always a manual entry (see
 * NotConfiguredVoiceProvider: no real provider is wired up yet). */
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
  });

  const { rows } = await query<CallLogRow>(
    `INSERT INTO call_log
       (direction, contact_id, script_version_id, status, duration_seconds, started_at, ended_at, outcome_notes, provider, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
    ]
  );
  return toEntity(rows[0]);
}

export async function countCalls(): Promise<number> {
  const { rows } = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM call_log');
  return Number(rows[0]?.count ?? 0);
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
