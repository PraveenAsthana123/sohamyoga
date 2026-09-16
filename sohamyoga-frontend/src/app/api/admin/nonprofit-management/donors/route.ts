import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const giving_level = searchParams.get('giving_level');
  const donor_type = searchParams.get('donor_type');
  const search = searchParams.get('search');

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (giving_level) { conditions.push(`giving_level = $${idx++}`); values.push(giving_level); }
    if (donor_type) { conditions.push(`donor_type = $${idx++}`); values.push(donor_type); }
    if (search) {
      conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx} OR employer ILIKE $${idx})`);
      values.push(`%${search}%`); idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT * FROM np_donor ${where} ORDER BY last_donation_date DESC NULLS LAST, total_donated DESC`,
      values
    );
    return NextResponse.json({ donors: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const {
    first_name, last_name, email, phone, address, city = 'Calgary', province = 'AB', postal_code,
    donor_type = 'individual', giving_level = 'friend', preferred_cause, communication_preference = 'email',
    tax_receipt_required = true, employer, employer_matching = false, notes,
  } = body;

  if (!first_name || !last_name || !email) {
    return NextResponse.json({ error: 'first_name, last_name, email required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO np_donor (first_name, last_name, email, phone, address, city, province, postal_code,
        donor_type, giving_level, preferred_cause, communication_preference, tax_receipt_required,
        employer, employer_matching, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [first_name, last_name, email, phone, address, city, province, postal_code,
        donor_type, giving_level, preferred_cause, communication_preference, tax_receipt_required,
        employer, employer_matching, notes]
    );
    return NextResponse.json({ donor: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
