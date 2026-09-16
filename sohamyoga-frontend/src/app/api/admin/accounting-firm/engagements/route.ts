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
  const status = searchParams.get('status');
  const clientId = searchParams.get('client_id');
  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const vals: unknown[] = [];
    if (status) { conditions.push(`e.status=$${vals.length + 1}`); vals.push(status); }
    if (clientId) { conditions.push(`e.client_id=$${vals.length + 1}`); vals.push(clientId); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT e.*, c.name AS client_name FROM accounting_engagement e JOIN accounting_client c ON c.id=e.client_id ${where} ORDER BY e.due_date NULLS LAST`,
      vals
    );
    return Response.json({ engagements: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.client_id || !body?.engagement_type) return Response.json({ error: 'client_id and engagement_type are required.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO accounting_engagement (client_id, engagement_type, period_start, period_end, status, assigned_to, due_date, hours_budget, fee, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [body.client_id, body.engagement_type, body.period_start, body.period_end, body.status ?? 'not_started', body.assigned_to, body.due_date, body.hours_budget, body.fee, body.notes]
    );
    return Response.json({ engagement: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
