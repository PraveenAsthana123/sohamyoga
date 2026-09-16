import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT *,
        CASE WHEN police_check_expiry IS NOT NULL THEN (police_check_expiry - CURRENT_DATE) ELSE NULL END as days_until_expiry
       FROM np_volunteer
       ${status ? 'WHERE status = $1' : ''}
       ORDER BY status, last_name, first_name`,
      status ? [status] : []
    );
    return NextResponse.json({ volunteers: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const {
    first_name, last_name, email, phone, skills, availability,
    languages = ['English'], police_check_date, police_check_expiry, notes,
  } = body;

  if (!first_name || !last_name || !email) {
    return NextResponse.json({ error: 'first_name, last_name, email required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO np_volunteer (first_name, last_name, email, phone, skills, availability,
        languages, police_check_date, police_check_expiry, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [first_name, last_name, email, phone, skills, availability, languages,
        police_check_date, police_check_expiry, notes]
    );
    return NextResponse.json({ volunteer: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
