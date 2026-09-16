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
    const [clientRow, engagements] = await Promise.all([
      client.query(`SELECT * FROM accounting_client WHERE id=$1`, [params.id]),
      client.query(`SELECT * FROM accounting_engagement WHERE client_id=$1 ORDER BY due_date`, [params.id]),
    ]);
    if (!clientRow.rows.length) return Response.json({ error: 'Client not found.' }, { status: 404 });
    return Response.json({ client: clientRow.rows[0], engagements: engagements.rows });
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
      `UPDATE accounting_client SET name=COALESCE($2,name), client_type=COALESCE($3,client_type), email=COALESCE($4,email), phone=COALESCE($5,phone), city=COALESCE($6,city), province=COALESCE($7,province), bn=COALESCE($8,bn), industry=COALESCE($9,industry), annual_revenue=COALESCE($10,annual_revenue), num_employees=COALESCE($11,num_employees), services=COALESCE($12,services), software=COALESCE($13,software), engagement_type=COALESCE($14,engagement_type), monthly_fee=COALESCE($15,monthly_fee), hourly_rate=COALESCE($16,hourly_rate), status=COALESCE($17,status), assigned_cpa=COALESCE($18,assigned_cpa), notes=COALESCE($19,notes) WHERE id=$1 RETURNING *`,
      [params.id, body.name, body.client_type, body.email, body.phone, body.city, body.province, body.bn, body.industry, body.annual_revenue, body.num_employees, body.services, body.software, body.engagement_type, body.monthly_fee, body.hourly_rate, body.status, body.assigned_cpa, body.notes]
    );
    if (!rows.length) return Response.json({ error: 'Client not found.' }, { status: 404 });
    return Response.json({ client: rows[0] });
  } finally {
    client.release();
  }
}
