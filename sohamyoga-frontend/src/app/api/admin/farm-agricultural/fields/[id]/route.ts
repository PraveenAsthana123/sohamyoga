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
      `SELECT f.*, c.farm_name, c.operator_name FROM ag_fields f JOIN ag_clients c ON c.id=f.client_id WHERE f.id=$1`,
      [params.id]
    );
    if (!rows.length) return Response.json({ error: 'Field not found.' }, { status: 404 });
    return Response.json({ field: rows[0] });
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
      `UPDATE ag_fields SET
        field_name=COALESCE($2,field_name), legal_description=COALESCE($3,legal_description),
        acres=COALESCE($4,acres), soil_zone=COALESCE($5,soil_zone), irrigation=COALESCE($6,irrigation),
        crop_this_year=COALESCE($7,crop_this_year), crop_last_year=COALESCE($8,crop_last_year),
        seeding_date=COALESCE($9,seeding_date), expected_harvest_date=COALESCE($10,expected_harvest_date),
        yield_estimate_bu_ac=COALESCE($11,yield_estimate_bu_ac), actual_yield_bu_ac=COALESCE($12,actual_yield_bu_ac),
        notes=COALESCE($13,notes)
       WHERE id=$1 RETURNING *`,
      [params.id, body.field_name, body.legal_description, body.acres, body.soil_zone,
       body.irrigation, body.crop_this_year, body.crop_last_year, body.seeding_date,
       body.expected_harvest_date, body.yield_estimate_bu_ac, body.actual_yield_bu_ac, body.notes]
    );
    if (!rows.length) return Response.json({ error: 'Field not found.' }, { status: 404 });
    return Response.json({ field: rows[0] });
  } finally {
    client.release();
  }
}
