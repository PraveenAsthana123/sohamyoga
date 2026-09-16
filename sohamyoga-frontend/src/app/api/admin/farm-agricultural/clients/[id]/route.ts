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
    const [clientRow, fields, jobs] = await Promise.all([
      client.query(`SELECT * FROM ag_clients WHERE id=$1`, [params.id]),
      client.query(`SELECT * FROM ag_fields WHERE client_id=$1 ORDER BY field_name`, [params.id]),
      client.query(`SELECT * FROM ag_jobs WHERE client_id=$1 ORDER BY scheduled_date DESC LIMIT 20`, [params.id]),
    ]);
    if (!clientRow.rows.length) return Response.json({ error: 'Client not found.' }, { status: 404 });
    return Response.json({ client: clientRow.rows[0], fields: fields.rows, jobs: jobs.rows });
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
      `UPDATE ag_clients SET
        farm_name=COALESCE($2,farm_name), operator_name=COALESCE($3,operator_name),
        email=COALESCE($4,email), phone=COALESCE($5,phone), address=COALESCE($6,address),
        municipality=COALESCE($7,municipality), province=COALESCE($8,province),
        quarter_sections=COALESCE($9,quarter_sections), total_acres=COALESCE($10,total_acres),
        operation_type=COALESCE($11,operation_type), primary_crops=COALESCE($12,primary_crops),
        livestock_types=COALESCE($13,livestock_types), afsc_policy_number=COALESCE($14,afsc_policy_number),
        carbon_credit_enrolled=COALESCE($15,carbon_credit_enrolled), notes=COALESCE($16,notes),
        is_active=COALESCE($17,is_active)
       WHERE id=$1 RETURNING *`,
      [params.id, body.farm_name, body.operator_name, body.email, body.phone, body.address,
       body.municipality, body.province, body.quarter_sections, body.total_acres,
       body.operation_type, body.primary_crops, body.livestock_types, body.afsc_policy_number,
       body.carbon_credit_enrolled, body.notes, body.is_active]
    );
    if (!rows.length) return Response.json({ error: 'Client not found.' }, { status: 404 });
    return Response.json({ client: rows[0] });
  } finally {
    client.release();
  }
}
