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
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (clientId) { conditions.push(`c.client_id=$${params.length + 1}`); params.push(clientId); }
    if (type) { conditions.push(`c.campaign_type=$${params.length + 1}`); params.push(type); }
    if (status) { conditions.push(`c.status=$${params.length + 1}`); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT c.*, cl.company_name FROM dac_campaign c
       LEFT JOIN dac_client cl ON cl.id=c.client_id
       ${where} ORDER BY c.created_at DESC`,
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
      `INSERT INTO dac_campaign (client_id, campaign_name, campaign_type, platform, objective, budget_monthly, start_date, end_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.client_id, body.campaign_name, body.campaign_type, body.platform, body.objective,
       body.budget_monthly || null, body.start_date || null, body.end_date || null, body.status || 'active']
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
