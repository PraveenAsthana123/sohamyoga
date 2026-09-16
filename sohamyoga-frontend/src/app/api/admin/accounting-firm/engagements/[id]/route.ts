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
    const { rows } = await client.query(
      `SELECT e.*, c.name AS client_name FROM accounting_engagement e JOIN accounting_client c ON c.id=e.client_id WHERE e.id=$1`,
      [params.id]
    );
    if (!rows.length) return Response.json({ error: 'Engagement not found.' }, { status: 404 });
    return Response.json({ engagement: rows[0] });
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
      `UPDATE accounting_engagement SET status=COALESCE($2,status), assigned_to=COALESCE($3,assigned_to), due_date=COALESCE($4,due_date), hours_budget=COALESCE($5,hours_budget), hours_actual=COALESCE($6,hours_actual), fee=COALESCE($7,fee), invoiced=COALESCE($8,invoiced), paid=COALESCE($9,paid), notes=COALESCE($10,notes) WHERE id=$1 RETURNING *`,
      [params.id, body.status, body.assigned_to, body.due_date, body.hours_budget, body.hours_actual, body.fee, body.invoiced, body.paid, body.notes]
    );
    if (!rows.length) return Response.json({ error: 'Engagement not found.' }, { status: 404 });
    return Response.json({ engagement: rows[0] });
  } finally {
    client.release();
  }
}
