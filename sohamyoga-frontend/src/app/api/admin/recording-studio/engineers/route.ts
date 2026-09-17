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
    const { rows } = await client.query(`SELECT * FROM rs_engineers WHERE is_active = true ORDER BY name`);
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
    const { name, email, phone, specialty, daw_proficiencies, day_rate, status, notes } = body;
    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO rs_engineers (name, email, phone, specialty, daw_proficiencies, day_rate, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, email, phone, specialty ?? [], daw_proficiencies ?? [], day_rate, status ?? 'available', notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
