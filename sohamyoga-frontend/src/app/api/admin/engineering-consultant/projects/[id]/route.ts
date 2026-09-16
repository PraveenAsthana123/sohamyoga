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
    const [proj, deliverables] = await Promise.all([
      client.query(`SELECT p.*, c.name AS client_name FROM engineering_project p JOIN engineering_client c ON c.id=p.client_id WHERE p.id=$1`, [params.id]),
      client.query(`SELECT * FROM engineering_deliverable WHERE project_id=$1 ORDER BY due_date`, [params.id]),
    ]);
    if (!proj.rows.length) return Response.json({ error: 'Project not found.' }, { status: 404 });
    return Response.json({ project: proj.rows[0], deliverables: deliverables.rows });
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
      `UPDATE engineering_project SET title=COALESCE($2,title), status=COALESCE($3,status), priority=COALESCE($4,priority), start_date=COALESCE($5,start_date), end_date=COALESCE($6,end_date), contract_value=COALESCE($7,contract_value), budget_hours=COALESCE($8,budget_hours), actual_hours=COALESCE($9,actual_hours), invoiced_amount=COALESCE($10,invoiced_amount), assigned_pe=COALESCE($11,assigned_pe), pe_stamp_required=COALESCE($12,pe_stamp_required), description=COALESCE($13,description) WHERE id=$1 RETURNING *`,
      [params.id, body.title, body.status, body.priority, body.start_date, body.end_date, body.contract_value, body.budget_hours, body.actual_hours, body.invoiced_amount, body.assigned_pe, body.pe_stamp_required, body.description]
    );
    if (!rows.length) return Response.json({ error: 'Project not found.' }, { status: 404 });
    return Response.json({ project: rows[0] });
  } finally {
    client.release();
  }
}
