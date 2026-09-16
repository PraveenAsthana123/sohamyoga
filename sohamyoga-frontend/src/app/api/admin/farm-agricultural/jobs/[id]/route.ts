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
      `SELECT j.*, c.farm_name, c.operator_name, f.field_name, f.acres AS field_acres
       FROM ag_jobs j JOIN ag_clients c ON c.id=j.client_id LEFT JOIN ag_fields f ON f.id=j.field_id
       WHERE j.id=$1`,
      [params.id]
    );
    if (!rows.length) return Response.json({ error: 'Job not found.' }, { status: 404 });
    return Response.json({ job: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid body.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE ag_jobs SET
        job_type=COALESCE($2,job_type), status=COALESCE($3,status),
        scheduled_date=COALESCE($4,scheduled_date), completed_date=COALESCE($5,completed_date),
        operator_name=COALESCE($6,operator_name), equipment_used=COALESCE($7,equipment_used),
        product_applied=COALESCE($8,product_applied), rate_per_ac=COALESCE($9,rate_per_ac),
        acres_done=COALESCE($10,acres_done), total_cost=COALESCE($11,total_cost),
        notes=COALESCE($12,notes)
       WHERE id=$1 RETURNING *`,
      [params.id, body.job_type, body.status, body.scheduled_date, body.completed_date,
       body.operator_name, body.equipment_used, body.product_applied, body.rate_per_ac,
       body.acres_done, body.total_cost, body.notes]
    );
    if (!rows.length) return Response.json({ error: 'Job not found.' }, { status: 404 });
    return Response.json({ job: rows[0] });
  } finally {
    client.release();
  }
}
