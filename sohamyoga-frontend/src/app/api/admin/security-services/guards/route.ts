import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const license_type = searchParams.get('license_type');
    const expiring = searchParams.get('expiring_soon') === 'true';

    let q = `SELECT *, (license_expiry - CURRENT_DATE) AS license_days_remaining, (first_aid_expiry - CURRENT_DATE) AS first_aid_days_remaining FROM sec_guard WHERE 1=1`;
    const vals: string[] = [];
    let idx = 1;
    if (status) { q += ` AND status = $${idx++}`; vals.push(status); }
    if (license_type) { q += ` AND license_type = $${idx++}`; vals.push(license_type); }
    if (expiring) { q += ` AND license_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`; }
    q += ` ORDER BY first_name, last_name`;

    const { rows } = await client.query(q, vals);
    return NextResponse.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { rows } = await client.query(`
      INSERT INTO sec_guard (first_name, last_name, email, phone, license_number, license_type, license_expiry, security_clearance, first_aid_certified, first_aid_expiry, certifications, languages, status, hourly_rate)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      body.first_name, body.last_name, body.email ?? null, body.phone,
      body.license_number ?? null, body.license_type ?? 'basic',
      body.license_expiry ?? null, body.security_clearance ?? null,
      body.first_aid_certified ?? false, body.first_aid_expiry ?? null,
      body.certifications ?? null, body.languages ?? ['English'],
      body.status ?? 'active', body.hourly_rate ?? null,
    ]);
    return NextResponse.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
