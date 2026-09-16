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
      `SELECT gc.*, c.farm_name FROM ag_grain_contracts gc JOIN ag_clients c ON c.id=gc.client_id WHERE gc.id=$1`,
      [params.id]
    );
    if (!rows.length) return Response.json({ error: 'Contract not found.' }, { status: 404 });
    return Response.json({ contract: rows[0] });
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
    // If recording delivery, increment bushels_delivered and auto-update status
    let statusClause = `status=COALESCE($11,status)`;
    if (body.bushels_delivered_delta) {
      statusClause = `
        bushels_delivered = bushels_delivered + $12,
        status = CASE
          WHEN bushels_delivered + $12 >= bushels_contracted THEN 'complete'
          WHEN bushels_delivered + $12 > 0 THEN 'partial'
          ELSE status
        END`;
    }
    const { rows } = await client.query(
      `UPDATE ag_grain_contracts SET
        commodity=COALESCE($2,commodity), contract_type=COALESCE($3,contract_type),
        bushels_contracted=COALESCE($4,bushels_contracted), price_per_bu=COALESCE($5,price_per_bu),
        basis_level=COALESCE($6,basis_level), delivery_start=COALESCE($7,delivery_start),
        delivery_end=COALESCE($8,delivery_end), buyer_name=COALESCE($9,buyer_name),
        elevator_location=COALESCE($10,elevator_location),
        status=COALESCE($11,status),
        bushels_delivered=COALESCE($12,bushels_delivered),
        notes=COALESCE($13,notes)
       WHERE id=$1 RETURNING *`,
      [params.id, body.commodity, body.contract_type, body.bushels_contracted, body.price_per_bu,
       body.basis_level, body.delivery_start, body.delivery_end, body.buyer_name,
       body.elevator_location, body.status, body.bushels_delivered, body.notes]
    );
    if (!rows.length) return Response.json({ error: 'Contract not found.' }, { status: 404 });
    return Response.json({ contract: rows[0] });
  } finally {
    client.release();
  }
}
