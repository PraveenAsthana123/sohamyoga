import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const db = await pool.connect();
    try {
      const { rows } = await db.query(`SELECT * FROM rh_location ORDER BY name`);
      return Response.json(rows);
    } finally { db.release(); }
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
    const db = await pool.connect();
    try {
      const { rows } = await db.query(
        `INSERT INTO rh_location (name,address,city,province,phone,email,cuisine_type,seating_capacity,patio_capacity,pos_system,liquor_license,liquor_license_expiry,health_inspection_date,health_inspection_score,status,manager_name)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [body.name,body.address,body.city||'Calgary',body.province||'AB',body.phone,body.email,body.cuisine_type,body.seating_capacity||null,body.patio_capacity||0,body.pos_system,body.liquor_license,body.liquor_license_expiry||null,body.health_inspection_date||null,body.health_inspection_score||null,body.status||'open',body.manager_name]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
