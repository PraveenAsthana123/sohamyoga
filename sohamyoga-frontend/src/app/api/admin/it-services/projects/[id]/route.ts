import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT p.*, c.name AS client_name FROM it_project p JOIN it_client c ON c.id=p.client_id WHERE p.id=$1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Project not found.' }, { status: 404 });
    return Response.json({ project: rows[0] });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid body.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE it_project SET title=COALESCE($2,title), status=COALESCE($3,status), project_type=COALESCE($4,project_type), start_date=COALESCE($5,start_date), end_date=COALESCE($6,end_date), contract_value=COALESCE($7,contract_value), hours_budget=COALESCE($8,hours_budget), hours_actual=COALESCE($9,hours_actual), notes=COALESCE($10,notes) WHERE id=$1 RETURNING *`,
      [params.id, body.title, body.status, body.project_type, body.start_date, body.end_date, body.contract_value, body.hours_budget, body.hours_actual, body.notes]
    );
    if (!rows.length) return Response.json({ error: 'Project not found.' }, { status: 404 });
    return Response.json({ project: rows[0] });
  } finally {
    client.release();
  }
}
