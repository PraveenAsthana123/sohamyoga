import { NextRequest } from 'next/server';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS insight_monitor_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    platforms TEXT[] NOT NULL,
    keywords TEXT[],
    min_rating INT,
    alert_on TEXT[] DEFAULT ARRAY['negative', 'mention'],
    notify_email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const pool = getPool();
    await pool.query(ENSURE_TABLE);

    const { rows } = await pool.query(
      'SELECT * FROM insight_monitor_rules ORDER BY created_at DESC',
    );

    return Response.json({ rules: rows });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const pool = getPool();
    await pool.query(ENSURE_TABLE);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { rule_name, platforms, keywords, min_rating, alert_on, notify_email, is_active } = body as Record<string, unknown>;

    if (typeof rule_name !== 'string' || !rule_name.trim()) {
      return Response.json({ error: 'rule_name is required.' }, { status: 400 });
    }
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return Response.json({ error: 'platforms array is required.' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO insight_monitor_rules (rule_name, platforms, keywords, min_rating, alert_on, notify_email, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        rule_name.trim(),
        platforms,
        Array.isArray(keywords) ? keywords : null,
        typeof min_rating === 'number' ? min_rating : null,
        Array.isArray(alert_on) ? alert_on : ['negative', 'mention'],
        typeof notify_email === 'string' ? notify_email : null,
        typeof is_active === 'boolean' ? is_active : true,
      ],
    );

    return Response.json({ rule: rows[0] }, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const pool = getPool();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid body.' }, { status: 400 });
    }

    const { id, is_active } = body as Record<string, unknown>;
    if (typeof id !== 'string') return Response.json({ error: 'id required.' }, { status: 400 });

    const { rows } = await pool.query(
      `UPDATE insight_monitor_rules SET is_active=$1 WHERE id=$2 RETURNING *`,
      [Boolean(is_active), id],
    );

    if (rows.length === 0) return Response.json({ error: 'Rule not found.' }, { status: 404 });
    return Response.json({ rule: rows[0] });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
