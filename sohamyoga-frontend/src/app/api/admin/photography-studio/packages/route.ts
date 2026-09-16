import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const rows = await client.query(`SELECT * FROM photo_package WHERE is_active = true ORDER BY price ASC`);
    return Response.json(rows.rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `INSERT INTO photo_package (name,shoot_type,description,price,duration_hours,includes_edited_photos,includes_prints,travel_included_km) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.name, b.shoot_type, b.description, b.price, b.duration_hours, b.includes_edited_photos, b.includes_prints ?? false, b.travel_included_km ?? 0]
    );
    return Response.json(row.rows[0], { status: 201 });
  } finally { client.release(); }
}
