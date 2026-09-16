import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS detection_alert (
    id SERIAL PRIMARY KEY,
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT,
    entity_type TEXT,
    entity_id TEXT,
    detected_value NUMERIC,
    threshold_value NUMERIC,
    status TEXT DEFAULT 'open',
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const alert_type = searchParams.get('alert_type');
  const severity = searchParams.get('severity');
  const status = searchParams.get('status');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (alert_type) { conditions.push(`alert_type = $${idx++}`); values.push(alert_type); }
  if (severity) { conditions.push(`severity = $${idx++}`); values.push(severity); }
  if (status) { conditions.push(`status = $${idx++}`); values.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM detection_alert ${where} ORDER BY created_at DESC LIMIT 500`,
    values
  );
  return Response.json({ alerts: rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const b = await req.json().catch(() => null);
  if (!b?.alert_type || !b?.title) return Response.json({ error: 'alert_type and title are required' }, { status: 400 });
  const { rows } = await pool.query(
    `INSERT INTO detection_alert (alert_type, severity, title, description, entity_type, entity_id, detected_value, threshold_value, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [b.alert_type, b.severity || 'medium', b.title, b.description || null,
     b.entity_type || null, b.entity_id || null, b.detected_value ?? null,
     b.threshold_value ?? null, b.metadata ? JSON.stringify(b.metadata) : null]
  );
  return Response.json({ alert: rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const b = await req.json().catch(() => null);
  if (!b?.id || !b?.status) return Response.json({ error: 'id and status are required' }, { status: 400 });
  const validStatuses = ['open', 'investigating', 'resolved', 'false_positive'];
  if (!validStatuses.includes(b.status)) return Response.json({ error: 'Invalid status' }, { status: 400 });
  const isResolved = b.status === 'resolved' || b.status === 'false_positive';
  const { rows } = await pool.query(
    `UPDATE detection_alert SET status = $1, resolved_at = $2, resolved_by = $3 WHERE id = $4 RETURNING *`,
    [b.status, isResolved ? new Date() : null, b.resolved_by || null, b.id]
  );
  if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ alert: rows[0] });
}
