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
    const [adjRow, activeClaims] = await Promise.all([
      client.query(`SELECT * FROM adj_adjusters WHERE id=$1`, [params.id]),
      client.query(`SELECT id, claim_number, insured_name, claim_type, status, priority, reserve_amount FROM adj_claims WHERE adjuster_id=$1 AND status NOT IN ('closed','denied') ORDER BY created_at DESC`, [params.id]),
    ]);
    if (!adjRow.rows.length) return Response.json({ error: 'Adjuster not found.' }, { status: 404 });
    return Response.json({ adjuster: adjRow.rows[0], active_claims: activeClaims.rows });
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
      `UPDATE adj_adjusters SET
        name=COALESCE($2,name),
        email=COALESCE($3,email),
        phone=COALESCE($4,phone),
        aic_license_number=COALESCE($5,aic_license_number),
        license_class=COALESCE($6,license_class),
        license_expiry=COALESCE($7,license_expiry),
        eando_insurer=COALESCE($8,eando_insurer),
        eando_expiry=COALESCE($9,eando_expiry),
        specializations=COALESCE($10,specializations),
        status=COALESCE($11,status),
        notes=COALESCE($12,notes),
        is_active=COALESCE($13,is_active)
       WHERE id=$1 RETURNING *`,
      [params.id, body.name, body.email, body.phone, body.aic_license_number, body.license_class, body.license_expiry, body.eando_insurer, body.eando_expiry, body.specializations, body.status, body.notes, body.is_active]
    );
    if (!rows.length) return Response.json({ error: 'Adjuster not found.' }, { status: 404 });
    return Response.json({ adjuster: rows[0] });
  } finally {
    client.release();
  }
}
