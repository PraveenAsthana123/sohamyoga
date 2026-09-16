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
        CASE WHEN bpp_expiry IS NOT NULL THEN (bpp_expiry - CURRENT_DATE) ELSE NULL END as bpp_days_remaining
       FROM ts_artist
       ${status ? 'WHERE status = $1' : ''}
       ORDER BY status, last_name`,
      status ? [status] : []
    );
    return NextResponse.json({ artists: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const {
    first_name, last_name, stage_name, email, phone,
    specialties, styles, bloodborne_pathogen_cert_date, bpp_expiry,
    alberta_health_permit = true, booth_rent, commission_pct,
    instagram_handle, portfolio_url, status = 'active',
  } = body;

  if (!first_name || !last_name) {
    return NextResponse.json({ error: 'first_name and last_name required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ts_artist (first_name, last_name, stage_name, email, phone,
        specialties, styles, bloodborne_pathogen_cert_date, bpp_expiry,
        alberta_health_permit, booth_rent, commission_pct, instagram_handle, portfolio_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [first_name, last_name, stage_name, email, phone,
        specialties, styles, bloodborne_pathogen_cert_date, bpp_expiry,
        alberta_health_permit, booth_rent, commission_pct, instagram_handle, portfolio_url, status]
    );
    return NextResponse.json({ artist: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
