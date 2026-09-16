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
    const { rows } = await client.query(`SELECT a.*, c.name AS client_name FROM it_asset a LEFT JOIN it_client c ON c.id=a.client_id WHERE a.id=$1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Asset not found.' }, { status: 404 });
    return Response.json({ asset: rows[0] });
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
      `UPDATE it_asset SET asset_type=COALESCE($2,asset_type), make=COALESCE($3,make), model=COALESCE($4,model), serial_number=COALESCE($5,serial_number), assigned_to_user=COALESCE($6,assigned_to_user), location=COALESCE($7,location), warranty_expiry=COALESCE($8,warranty_expiry), os=COALESCE($9,os), os_version=COALESCE($10,os_version), last_patch_date=COALESCE($11,last_patch_date), status=COALESCE($12,status), notes=COALESCE($13,notes) WHERE id=$1 RETURNING *`,
      [params.id, body.asset_type, body.make, body.model, body.serial_number, body.assigned_to_user, body.location, body.warranty_expiry, body.os, body.os_version, body.last_patch_date, body.status, body.notes]
    );
    if (!rows.length) return Response.json({ error: 'Asset not found.' }, { status: 404 });
    return Response.json({ asset: rows[0] });
  } finally {
    client.release();
  }
}
