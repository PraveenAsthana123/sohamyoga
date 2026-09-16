import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT a.*, CONCAT(c.first_name, ' ', c.last_name) as client_name,
        c.phone as client_phone, c.id_verified, c.bloodborne_pathogen_consent,
        DATE_PART('year', AGE(c.date_of_birth)) as client_age
       FROM ts_appointment a
       LEFT JOIN ts_client c ON c.id = a.client_id
       WHERE a.id = $1`, [params.id]
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ appointment: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const fields = ['artist','appointment_type','scheduled_at','duration_hours','deposit_amount',
    'deposit_paid','status','placement','size_inches','style','colors',
    'reference_image_url','design_notes','notes','client_rating'];

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const f of fields) {
    if (body[f] !== undefined) { updates.push(`${f} = $${idx++}`); values.push(body[f]); }
  }

  if (!updates.length) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  values.push(params.id);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE ts_appointment SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ appointment: rows[0] });
  } finally {
    client.release();
  }
}
