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
    const occupied = searchParams.get('is_occupied') ?? '';
    const size = searchParams.get('size') ?? '';
    const type = searchParams.get('type') ?? '';
    let where = 'WHERE 1=1';
    const vals: unknown[] = [];
    if (occupied !== '') { vals.push(occupied === 'true'); where += ` AND is_occupied = $${vals.length}`; }
    if (size) { vals.push(size); where += ` AND unit_size = $${vals.length}`; }
    if (type) { vals.push(type); where += ` AND unit_type = $${vals.length}`; }
    const { rows } = await client.query(`SELECT * FROM sm_storage_unit ${where} ORDER BY unit_number LIMIT 200`, vals);
    // Also get availability by size
    const { rows: avail } = await client.query(
      `SELECT unit_size, COUNT(*) FILTER(WHERE NOT is_occupied) AS available, COUNT(*) AS total FROM sm_storage_unit GROUP BY unit_size ORDER BY unit_size`
    );
    return Response.json({ units: rows, availability: avail });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO sm_storage_unit (unit_number, unit_size, unit_type, monthly_rate, floor, building)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [b.unit_number, b.unit_size, b.unit_type ?? 'standard', b.monthly_rate, b.floor ?? null, b.building ?? null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
