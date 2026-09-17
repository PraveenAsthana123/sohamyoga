import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ds_instructors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        instructor_cert_number TEXT,
        cert_expiry DATE,
        license_classes TEXT[],
        hourly_rate NUMERIC(8,2),
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows } = await client.query(
      `SELECT *,
              CASE WHEN cert_expiry IS NOT NULL THEN cert_expiry - CURRENT_DATE ELSE NULL END AS days_until_cert_expiry
       FROM ds_instructors ORDER BY status, name`,
    );

    return Response.json({ instructors: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { name, email, phone, instructor_cert_number, cert_expiry, license_classes, hourly_rate, notes } = body;

  if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ds_instructors (name, email, phone, instructor_cert_number, cert_expiry, license_classes, hourly_rate, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, email || null, phone || null, instructor_cert_number || null, cert_expiry || null, license_classes || [], hourly_rate || null, notes || null],
    );
    return Response.json({ instructor: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
