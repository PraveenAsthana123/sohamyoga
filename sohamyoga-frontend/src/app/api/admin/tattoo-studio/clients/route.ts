import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT *,
        DATE_PART('year', AGE(date_of_birth)) as age
       FROM ts_client
       ${search ? `WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1` : ''}
       ORDER BY last_name, first_name`,
      search ? [`%${search}%`] : []
    );
    return NextResponse.json({ clients: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const {
    first_name, last_name, email, phone, date_of_birth,
    id_verified = false, id_type, id_number,
    health_conditions, medications, allergies,
    skin_type, keloid_prone = false,
    bloodborne_pathogen_consent = false, consent_date,
    preferred_artist, referral_source, notes,
  } = body;

  if (!first_name || !last_name || !phone || !date_of_birth) {
    return NextResponse.json({ error: 'first_name, last_name, phone, date_of_birth required' }, { status: 400 });
  }

  // Age 18+ check
  const age = calcAge(date_of_birth);
  if (age < 18) {
    return NextResponse.json({ error: 'Client must be 18 or older. Date of birth indicates age: ' + age }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ts_client (first_name, last_name, email, phone, date_of_birth,
        id_verified, id_type, id_number, health_conditions, medications, allergies,
        skin_type, keloid_prone, bloodborne_pathogen_consent, consent_date,
        preferred_artist, referral_source, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [first_name, last_name, email, phone, date_of_birth,
        id_verified, id_type, id_number, health_conditions, medications, allergies,
        skin_type, keloid_prone, bloodborne_pathogen_consent, consent_date,
        preferred_artist, referral_source, notes]
    );
    return NextResponse.json({ client: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
