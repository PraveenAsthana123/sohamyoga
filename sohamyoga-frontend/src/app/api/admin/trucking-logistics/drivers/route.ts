import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const employment_type = searchParams.get('employment_type');
    const license_class = searchParams.get('license_class');
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (status) { values.push(status); conditions.push(`status = $${values.length}`); }
      if (employment_type) { values.push(employment_type); conditions.push(`employment_type = $${values.length}`); }
      if (license_class) { values.push(license_class); conditions.push(`license_class = $${values.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`SELECT * FROM tl_driver ${where} ORDER BY name`, values);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO tl_driver (name,email,phone,license_number,license_class,license_expiry,abstract_date,medical_expiry,status,employment_type,base_city,province,hourly_rate,per_km_rate,per_load_rate,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [body.name,body.email,body.phone,body.license_number,body.license_class||'Class 1',body.license_expiry||null,body.abstract_date||null,body.medical_expiry||null,body.status||'active',body.employment_type||'employee',body.base_city||'Calgary',body.province||'AB',body.hourly_rate||null,body.per_km_rate||null,body.per_load_rate||null,body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
