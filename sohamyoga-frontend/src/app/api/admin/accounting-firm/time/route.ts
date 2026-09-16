import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const engagementId = searchParams.get('engagement_id');
  const billable = searchParams.get('billable');
  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const vals: unknown[] = [];
    if (clientId) { conditions.push(`t.client_id=$${vals.length + 1}`); vals.push(clientId); }
    if (engagementId) { conditions.push(`t.engagement_id=$${vals.length + 1}`); vals.push(engagementId); }
    if (billable) { conditions.push(`t.billable=$${vals.length + 1}`); vals.push(billable === 'true'); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT t.*, c.name AS client_name FROM accounting_time_entry t LEFT JOIN accounting_client c ON c.id=t.client_id ${where} ORDER BY t.date DESC, t.created_at DESC`,
      vals
    );
    return Response.json({ entries: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.client_id || !body?.description || body?.hours == null) return Response.json({ error: 'client_id, description, and hours are required.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Update hours_actual on engagement if provided
    if (body.engagement_id) {
      await client.query(
        `UPDATE accounting_engagement SET hours_actual = hours_actual + $1 WHERE id=$2`,
        [body.hours, body.engagement_id]
      );
    }
    const { rows } = await client.query(
      `INSERT INTO accounting_time_entry (engagement_id, client_id, date, staff_name, service_code, description, hours, rate, billable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.engagement_id, body.client_id, body.date, body.staff_name, body.service_code, body.description, body.hours, body.rate, body.billable ?? true]
    );
    return Response.json({ entry: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
