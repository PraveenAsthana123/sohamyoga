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
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    let q = `SELECT * FROM rs_equipment WHERE is_active = true`;
    const params: string[] = [];
    if (category) { params.push(category); q += ` AND category = $${params.length}`; }
    if (status) { params.push(status); q += ` AND condition = $${params.length}`; }
    q += ` ORDER BY name`;
    const { rows } = await client.query(q, params);
    return Response.json(rows);
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
    const body = await req.json();
    const { name, category, brand, model, serial_number, insurance_value, condition, last_service_date, next_service_due, notes } = body;
    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO rs_equipment (name, category, brand, model, serial_number, insurance_value, condition, last_service_date, next_service_due, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, category, brand, model, serial_number, insurance_value, condition ?? 'good', last_service_date || null, next_service_due || null, notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
