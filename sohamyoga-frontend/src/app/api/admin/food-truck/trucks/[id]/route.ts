import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const today = new Date().toISOString().split('T')[0];
  const in60 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: trucks } = await client.query('SELECT * FROM ft_truck WHERE id = $1', [params.id]);
    if (!trucks.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const t = trucks[0];
    const alerts: string[] = [];
    if (t.permit_expiry && t.permit_expiry <= in60) alerts.push(`Alberta Health Permit expires ${t.permit_expiry}`);
    if (t.business_license_expiry && t.business_license_expiry <= in60) alerts.push(`Business License expires ${t.business_license_expiry}`);
    if (t.fire_extinguisher_expiry && t.fire_extinguisher_expiry <= in60) alerts.push(`Fire Extinguisher expires ${t.fire_extinguisher_expiry}`);
    if (t.insurance_expiry && t.insurance_expiry <= in60) alerts.push(`Insurance expires ${t.insurance_expiry}`);

    return NextResponse.json({ truck: t, expiry_alerts: alerts });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const fields = ['truck_name','truck_number','cuisine_type','vehicle_type','license_plate',
    'vehicle_year','vehicle_make','vehicle_model','commissary_kitchen',
    'alberta_health_permit_number','permit_expiry','calgary_business_license','business_license_expiry',
    'fire_extinguisher_expiry','insurance_expiry','capacity_servings_per_hour','is_active'];

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const f of fields) {
    if (body[f] !== undefined) {
      updates.push(`${f} = $${idx++}`);
      values.push(body[f]);
    }
  }

  if (!updates.length) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  values.push(params.id);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE ft_truck SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ truck: rows[0] });
  } finally {
    client.release();
  }
}
