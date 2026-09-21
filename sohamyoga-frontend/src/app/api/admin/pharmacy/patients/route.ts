import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const search = req.nextUrl.searchParams.get('search') ?? '';
    const rows = await client.query(
      `SELECT * FROM rx_patient WHERE (first_name ILIKE $1 OR last_name ILIKE $1 OR health_card_number ILIKE $1 OR phone ILIKE $1) ORDER BY last_name, first_name LIMIT 200`,
      [`%${search}%`]
    );
    return Response.json(rows.rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `INSERT INTO rx_patient (first_name,last_name,date_of_birth,health_card_number,phone,email,address,city,province,postal_code,allergies,current_conditions,insurance_provider,insurance_id,insurance_group,preferred_pharmacist,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [b.first_name, b.last_name, b.date_of_birth, b.health_card_number, b.phone, b.email, b.address, b.city ?? 'Calgary', b.province ?? 'AB', b.postal_code,
       b.allergies ?? [], b.current_conditions ?? [], b.insurance_provider, b.insurance_id, b.insurance_group, b.preferred_pharmacist, b.notes]
    );
    return Response.json(row.rows[0], { status: 201 });
  } finally { client.release(); }
}
