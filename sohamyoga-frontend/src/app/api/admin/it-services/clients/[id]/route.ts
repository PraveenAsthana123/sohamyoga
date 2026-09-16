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
    const [cl, tickets, assets] = await Promise.all([
      client.query(`SELECT * FROM it_client WHERE id=$1`, [params.id]),
      client.query(`SELECT * FROM it_ticket WHERE client_id=$1 ORDER BY created_at DESC LIMIT 20`, [params.id]),
      client.query(`SELECT * FROM it_asset WHERE client_id=$1 ORDER BY asset_type`, [params.id]),
    ]);
    if (!cl.rows.length) return Response.json({ error: 'Client not found.' }, { status: 404 });
    return Response.json({ client: cl.rows[0], tickets: tickets.rows, assets: assets.rows });
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
      `UPDATE it_client SET name=COALESCE($2,name), contact_person=COALESCE($3,contact_person), email=COALESCE($4,email), phone=COALESCE($5,phone), industry=COALESCE($6,industry), num_users=COALESCE($7,num_users), num_devices=COALESCE($8,num_devices), cloud_platform=COALESCE($9,cloud_platform), services=COALESCE($10,services), contract_type=COALESCE($11,contract_type), monthly_fee=COALESCE($12,monthly_fee), sla_response_hours=COALESCE($13,sla_response_hours), sla_resolution_hours=COALESCE($14,sla_resolution_hours), status=COALESCE($15,status), notes=COALESCE($16,notes) WHERE id=$1 RETURNING *`,
      [params.id, body.name, body.contact_person, body.email, body.phone, body.industry, body.num_users, body.num_devices, body.cloud_platform, body.services, body.contract_type, body.monthly_fee, body.sla_response_hours, body.sla_resolution_hours, body.status, body.notes]
    );
    if (!rows.length) return Response.json({ error: 'Client not found.' }, { status: 404 });
    return Response.json({ client: rows[0] });
  } finally {
    client.release();
  }
}
