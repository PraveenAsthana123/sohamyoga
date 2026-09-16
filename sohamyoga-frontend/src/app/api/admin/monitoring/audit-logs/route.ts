import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_AUDIT_LOG = `
  CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    user_id TEXT,
    user_email TEXT,
    changes JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

interface AuditRow {
  id: string | number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  user_email: string | null;
  changes: unknown;
  ip_address: string | null;
  created_at: string;
  source: string;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));
  const action = searchParams.get('action') ?? '';
  const entityType = searchParams.get('entityType') ?? '';

  const client = await pool.connect();
  try {
    await client.query(CREATE_AUDIT_LOG);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (action) {
      conditions.push(`action ILIKE $${values.length + 1}`);
      values.push(`%${action}%`);
    }
    if (entityType) {
      conditions.push(`entity_type ILIKE $${values.length + 1}`);
      values.push(`%${entityType}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const [mainRows, countResult] = await Promise.all([
      client.query(
        `SELECT id, action, entity_type, entity_id, user_id, user_email, changes, ip_address, created_at,
                'audit_log' AS source
         FROM audit_log ${where}
         ORDER BY created_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, pageSize, offset],
      ),
      client.query(
        `SELECT COUNT(*)::int AS total FROM audit_log ${where}`,
        values,
      ),
    ]);

    // Gracefully pull recent login events as supplementary context (not paginated separately)
    const loginRows = await client.query<{
      id: string;
      event_type: string;
      identity_id: string | null;
      ip_address: string | null;
      occurred_at: string;
    }>(`
      SELECT id::text, event_type, identity_id, ip_address::text, occurred_at
      FROM login_audit_event
      ORDER BY occurred_at DESC LIMIT 20
    `).catch(() => ({ rows: [] }));

    const supplementary: AuditRow[] = loginRows.rows.map((r) => ({
      id: r.id,
      action: r.event_type,
      entity_type: 'auth',
      entity_id: r.identity_id ?? null,
      user_id: r.identity_id ?? null,
      user_email: null,
      changes: null,
      ip_address: r.ip_address ?? null,
      created_at: r.occurred_at,
      source: 'login_audit_event',
    }));

    return Response.json({
      items: mainRows.rows as AuditRow[],
      supplementary,
      total: countResult.rows[0]?.total ?? 0,
      page,
      pageSize,
    });
  } finally {
    client.release();
  }
}
