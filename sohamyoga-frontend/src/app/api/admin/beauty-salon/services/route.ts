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
    const category = searchParams.get('category');
    const pool = getPool();
    const client = await pool.connect();
    try {
      const params: unknown[] = [];
      let where = `WHERE is_active=true`;
      if (category) { params.push(category); where += ` AND category=$${params.length}`; }
      const { rows } = await client.query(`SELECT * FROM salon_service ${where} ORDER BY category, name`, params);
      return Response.json({ services: rows });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { name, category, description, duration_minutes = 60, price, stylist } = body;
    if (!name || !category || !price) return Response.json({ error: 'name, category, price required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO salon_service (name,category,description,duration_minutes,price,stylist) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [name, category, description ?? null, duration_minutes, price, stylist ?? null]
      );
      return Response.json({ service: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
