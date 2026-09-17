import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const program = searchParams.get('program') ?? '';
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ds_students (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        date_of_birth DATE,
        alberta_id TEXT,
        program TEXT CHECK(program IN ('class5_gdl','class5_full','class1_melt','class6_motorcycle','refresher')) DEFAULT 'class5_gdl',
        lessons_purchased INT DEFAULT 0,
        lessons_completed INT DEFAULT 0,
        theory_test_passed BOOLEAN DEFAULT false,
        road_test_passed BOOLEAN DEFAULT false,
        road_test_attempts INT DEFAULT 0,
        status TEXT DEFAULT 'enrolled',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (program && program !== 'all') {
      conditions.push(`program = $${values.length + 1}`);
      values.push(program);
    }
    if (status && status !== 'all') {
      conditions.push(`status = $${values.length + 1}`);
      values.push(status);
    }
    if (search) {
      conditions.push(`(first_name ILIKE $${values.length + 1} OR last_name ILIKE $${values.length + 1} OR email ILIKE $${values.length + 1} OR alberta_id ILIKE $${values.length + 1})`);
      values.push(`%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT * FROM ds_students ${where} ORDER BY created_at DESC LIMIT 200`,
      values,
    );

    return Response.json({ students: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { first_name, last_name, email, phone, date_of_birth, alberta_id, program, lessons_purchased, notes } = body;

  if (!first_name || !last_name) {
    return Response.json({ error: 'first_name and last_name are required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ds_students (first_name, last_name, email, phone, date_of_birth, alberta_id, program, lessons_purchased, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [first_name, last_name, email || null, phone || null, date_of_birth || null, alberta_id || null, program || 'class5_gdl', lessons_purchased || 0, notes || null],
    );
    return Response.json({ student: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
