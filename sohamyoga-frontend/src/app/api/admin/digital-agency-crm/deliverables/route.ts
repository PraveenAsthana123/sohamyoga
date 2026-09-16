import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('client_id');
    const status = searchParams.get('status');
    const dueThisWeek = searchParams.get('due_this_week');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (clientId) { conditions.push(`d.client_id=$${params.length + 1}`); params.push(clientId); }
    if (status) { conditions.push(`d.status=$${params.length + 1}`); params.push(status); }
    if (dueThisWeek === 'true') {
      conditions.push(`d.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT d.*, cl.company_name, ca.campaign_name FROM dac_deliverable d
       LEFT JOIN dac_client cl ON cl.id=d.client_id
       LEFT JOIN dac_campaign ca ON ca.id=d.campaign_id
       ${where} ORDER BY d.due_date NULLS LAST, d.created_at DESC`,
      params
    );
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO dac_deliverable (client_id, campaign_id, deliverable_type, title, assigned_to, due_date, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.client_id, body.campaign_id || null, body.deliverable_type, body.title,
       body.assigned_to, body.due_date || null, body.status || 'todo', body.notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
