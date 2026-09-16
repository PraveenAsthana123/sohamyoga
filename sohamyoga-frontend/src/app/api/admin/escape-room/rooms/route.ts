import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get('active') === 'true';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const where = activeOnly ? 'WHERE is_active=true' : '';
    const r = await client.query(`SELECT * FROM er_room ${where} ORDER BY room_name`);
    return Response.json({ rooms: r.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO er_room (room_name,theme,description,difficulty,min_players,max_players,duration_minutes,price_per_person,min_booking_amount)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.room_name,body.theme,body.description,body.difficulty||'medium',
       body.min_players||2,body.max_players||8,body.duration_minutes||60,
       body.price_per_person,body.min_booking_amount||null]
    );
    return Response.json({ room: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
