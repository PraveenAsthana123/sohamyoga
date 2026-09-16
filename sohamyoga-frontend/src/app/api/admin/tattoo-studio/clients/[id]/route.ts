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
    const { rows: clients } = await client.query(
      `SELECT *, DATE_PART('year', AGE(date_of_birth)) as age FROM ts_client WHERE id = $1`, [params.id]
    );
    if (!clients.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { rows: appointments } = await client.query(
      `SELECT * FROM ts_appointment WHERE client_id = $1 ORDER BY scheduled_at DESC`, [params.id]
    );

    return NextResponse.json({ client: clients[0], appointments, consent_status: {
      id_verified: clients[0].id_verified,
      bloodborne_pathogen_consent: clients[0].bloodborne_pathogen_consent,
      consent_date: clients[0].consent_date,
      age: clients[0].age,
    }});
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const fields = ['first_name','last_name','email','phone','id_verified','id_type','id_number',
    'health_conditions','medications','allergies','skin_type','keloid_prone',
    'bloodborne_pathogen_consent','consent_date','preferred_artist','referral_source','notes'];

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
      `UPDATE ts_client SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ client: rows[0] });
  } finally {
    client.release();
  }
}
