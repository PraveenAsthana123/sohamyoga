import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const artist = searchParams.get('artist');
  const status = searchParams.get('status');

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (date) { conditions.push(`DATE(a.scheduled_at) = $${idx++}`); values.push(date); }
    if (artist) { conditions.push(`a.artist = $${idx++}`); values.push(artist); }
    if (status) { conditions.push(`a.status = $${idx++}`); values.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT a.*, CONCAT(c.first_name, ' ', c.last_name) as client_name,
        c.phone as client_phone, c.id_verified, c.bloodborne_pathogen_consent,
        DATE_PART('year', AGE(c.date_of_birth)) as client_age
       FROM ts_appointment a
       LEFT JOIN ts_client c ON c.id = a.client_id
       ${where}
       ORDER BY a.scheduled_at`,
      values
    );
    return NextResponse.json({ appointments: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const {
    client_id, artist, appointment_type, scheduled_at, duration_hours = 2,
    deposit_amount = 100, deposit_paid = false, placement, size_inches, style,
    colors = 'black_grey', reference_image_url, design_notes, notes,
  } = body;

  if (!client_id || !artist || !appointment_type || !scheduled_at) {
    return NextResponse.json({ error: 'client_id, artist, appointment_type, scheduled_at required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Check client id_verified and consent
    const { rows: clients } = await client.query(
      `SELECT id_verified, bloodborne_pathogen_consent, DATE_PART('year', AGE(date_of_birth)) as age FROM ts_client WHERE id = $1`,
      [client_id]
    );
    if (!clients.length) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const cl = clients[0];
    if (!cl.id_verified) {
      return NextResponse.json({ error: 'Client ID must be verified before booking' }, { status: 400 });
    }
    if (!cl.bloodborne_pathogen_consent) {
      return NextResponse.json({ error: 'Client must sign bloodborne pathogen consent before booking' }, { status: 400 });
    }
    if (Number(cl.age) < 18) {
      return NextResponse.json({ error: 'Client is under 18 — cannot book appointment' }, { status: 400 });
    }

    const { rows } = await client.query(
      `INSERT INTO ts_appointment (client_id, artist, appointment_type, scheduled_at, duration_hours,
        deposit_amount, deposit_paid, placement, size_inches, style, colors,
        reference_image_url, design_notes, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [client_id, artist, appointment_type, scheduled_at, duration_hours,
        deposit_amount, deposit_paid, placement, size_inches, style, colors,
        reference_image_url, design_notes, notes]
    );
    return NextResponse.json({ appointment: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
