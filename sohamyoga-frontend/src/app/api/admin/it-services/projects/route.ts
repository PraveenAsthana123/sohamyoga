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
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const conditions: string[] = [];
  const vals: unknown[] = [];
  if (clientId) { conditions.push(`p.client_id=$${vals.length + 1}`); vals.push(clientId); }
  if (status) { conditions.push(`p.status=$${vals.length + 1}`); vals.push(status); }
  if (type) { conditions.push(`p.project_type=$${vals.length + 1}`); vals.push(type); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT p.*, c.name AS client_name FROM it_project p JOIN it_client c ON c.id=p.client_id ${where} ORDER BY p.created_at DESC`,
      vals
    );
    return Response.json({ projects: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.client_id || !body?.title) return Response.json({ error: 'client_id and title are required.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO it_project (client_id, title, project_type, status, start_date, end_date, contract_value, hours_budget, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.client_id, body.title, body.project_type, body.status ?? 'scoping', body.start_date, body.end_date, body.contract_value, body.hours_budget, body.notes]
    );
    return Response.json({ project: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
