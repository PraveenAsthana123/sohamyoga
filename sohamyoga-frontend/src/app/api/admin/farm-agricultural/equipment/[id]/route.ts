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
    const { rows } = await client.query(`SELECT * FROM ag_equipment WHERE id=$1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Equipment not found.' }, { status: 404 });
    return Response.json({ equipment: rows[0] });
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
      `UPDATE ag_equipment SET
        name=COALESCE($2,name), type=COALESCE($3,type), make=COALESCE($4,make),
        model=COALESCE($5,model), year=COALESCE($6,year), serial_number=COALESCE($7,serial_number),
        hours_meter=COALESCE($8,hours_meter), next_service_hours=COALESCE($9,next_service_hours),
        next_service_date=COALESCE($10,next_service_date), condition=COALESCE($11,condition),
        insurance_expiry=COALESCE($12,insurance_expiry), notes=COALESCE($13,notes),
        is_available=COALESCE($14,is_available)
       WHERE id=$1 RETURNING *`,
      [params.id, body.name, body.type, body.make, body.model, body.year, body.serial_number,
       body.hours_meter, body.next_service_hours, body.next_service_date, body.condition,
       body.insurance_expiry, body.notes, body.is_available]
    );
    if (!rows.length) return Response.json({ error: 'Equipment not found.' }, { status: 404 });
    return Response.json({ equipment: rows[0] });
  } finally {
    client.release();
  }
}
