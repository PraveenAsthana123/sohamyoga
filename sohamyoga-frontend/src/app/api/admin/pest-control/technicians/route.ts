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
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const license_class = searchParams.get('license_class');
    const conditions: string[] = ['t.is_active = true'];
    const vals: unknown[] = [];
    let idx = 1;
    if (status) { conditions.push(`t.status = $${idx++}`); vals.push(status); }
    if (license_class) { conditions.push(`t.license_class = $${idx++}`); vals.push(license_class); }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const { rows } = await client.query(
      `SELECT t.*, COUNT(j.id) FILTER (WHERE j.status != 'completed') AS active_jobs
       FROM pc_technicians t
       LEFT JOIN pc_jobs j ON j.technician_id = t.id
       ${where}
       GROUP BY t.id
       ORDER BY t.name`,
      vals
    );
    return Response.json({ technicians: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b?.name) return Response.json({ error: 'name is required.' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO pc_technicians (name, email, phone, pesticide_license_number, license_class, license_expiry, wcb_coverage, vehicle_plate, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [b.name, b.email ?? null, b.phone ?? null, b.pesticide_license_number ?? null, b.license_class ?? null, b.license_expiry ?? null, b.wcb_coverage ?? true, b.vehicle_plate ?? null, b.status ?? 'available', b.notes ?? null]
    );
    return Response.json({ technician: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
