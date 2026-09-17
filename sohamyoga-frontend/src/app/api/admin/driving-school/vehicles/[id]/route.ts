import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM ds_vehicles WHERE id = $1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Vehicle not found' }, { status: 404 });
    return Response.json({ vehicle: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const allowed = ['make','model','year','license_plate','dual_controls','vehicle_type','insurance_expiry','registration_expiry','condition','status','notes'];
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${values.length + 1}`);
      values.push(body[key]);
    }
  }
  if (!sets.length) return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  values.push(params.id);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE ds_vehicles SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!rows.length) return Response.json({ error: 'Vehicle not found' }, { status: 404 });
    return Response.json({ vehicle: rows[0] });
  } finally {
    client.release();
  }
}
