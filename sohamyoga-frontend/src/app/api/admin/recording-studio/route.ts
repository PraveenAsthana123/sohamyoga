import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS studio_booking (
        id SERIAL PRIMARY KEY, booking_number TEXT,
        artist_name TEXT NOT NULL, artist_email TEXT, artist_phone TEXT,
        studio_room TEXT DEFAULT 'Studio A',
        engineer TEXT,
        session_type TEXT DEFAULT 'recording',
        start_time TIMESTAMPTZ, end_time TIMESTAMPTZ,
        rate_per_hour NUMERIC(8,2) DEFAULT 75,
        deposit NUMERIC(10,2) DEFAULT 0,
        total_amount NUMERIC(10,2),
        notes TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS studio_track (
        id SERIAL PRIMARY KEY, booking_id INT REFERENCES studio_booking(id) ON DELETE SET NULL,
        title TEXT NOT NULL, artist TEXT, genre TEXT DEFAULT 'pop',
        bpm INT, key_signature TEXT,
        duration TEXT,
        recorded_at TIMESTAMPTZ DEFAULT NOW(),
        engineer TEXT,
        file_path TEXT,
        isrc TEXT,
        status TEXT DEFAULT 'raw',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ bookings: [], tracks: [] });
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [bookings, tracks] = await Promise.all([
      client.query('SELECT * FROM studio_booking ORDER BY start_time DESC LIMIT 100'),
      client.query('SELECT * FROM studio_track ORDER BY recorded_at DESC LIMIT 200'),
    ]);
    return Response.json({ bookings: bookings.rows, tracks: tracks.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.type === 'track') {
      const r = await client.query(
        'INSERT INTO studio_track (title, artist, genre) VALUES ($1,$2,$3) RETURNING *',
        [body.title ?? '', body.artist ?? '', body.genre ?? 'pop']
      );
      return Response.json(r.rows[0]);
    }
    const bookNum = `SB-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`;
    const r = await client.query(
      'INSERT INTO studio_booking (booking_number, artist_name, studio_room, engineer, session_type, start_time, rate_per_hour) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [bookNum, body.artist_name ?? '', body.studio_room ?? 'Studio A', body.engineer ?? '', body.session_type ?? 'recording', body.start_time ?? new Date(), body.rate_per_hour ?? 75]
    );
    return Response.json(r.rows[0]);
  } finally { client.release(); }
}
