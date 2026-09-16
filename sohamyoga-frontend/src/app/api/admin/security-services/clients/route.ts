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
    const q = status
      ? `SELECT * FROM sec_client WHERE status = $1 ORDER BY company_name`
      : `SELECT * FROM sec_client ORDER BY company_name`;
    const { rows } = await client.query(q, status ? [status] : []);
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
      INSERT INTO sec_client (company_name, contact_name, contact_email, contact_phone, address, city, province, contract_type, service_types, monthly_value, contract_start, contract_end, site_count, special_instructions, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      body.company_name, body.contact_name, body.contact_email, body.contact_phone,
      body.address, body.city ?? 'Calgary', body.province ?? 'AB',
      body.contract_type ?? 'monthly', body.service_types ?? ['static_guard'],
      body.monthly_value ?? null, body.contract_start ?? null, body.contract_end ?? null,
      body.site_count ?? 1, body.special_instructions ?? null, body.status ?? 'active',
    ]);
    return NextResponse.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
