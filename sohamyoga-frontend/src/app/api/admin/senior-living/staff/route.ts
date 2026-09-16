import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const shift = searchParams.get('shift');
    const role = searchParams.get('role');
    const conditions: string[] = ['is_active = true'];
    const vals: unknown[] = [];
    let idx = 1;
    if (shift) { conditions.push(`shift = $${idx++}`); vals.push(shift); }
    if (role) { conditions.push(`role = $${idx++}`); vals.push(role); }
    const { rows } = await client.query(
      `SELECT * FROM sl_staff WHERE ${conditions.join(' AND ')} ORDER BY shift, role, name`, vals
    );
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(`
      INSERT INTO sl_staff (name, role, certification_number, certification_expiry, shift, status, vulnerable_sector_check_date, notes, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.name, b.role, b.certification_number, b.certification_expiry || null, b.shift || 'day', b.status || 'off_duty', b.vulnerable_sector_check_date || null, b.notes, b.is_active !== false]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
