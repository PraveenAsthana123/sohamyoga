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
    const genre = searchParams.get('genre');
    const search = searchParams.get('search');
    let q = `SELECT * FROM rs_clients WHERE is_active = true`;
    const params: string[] = [];
    if (genre) { params.push(genre); q += ` AND genre = $${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (artist_name ILIKE $${params.length} OR contact_name ILIKE $${params.length} OR email ILIKE $${params.length})`; }
    q += ` ORDER BY artist_name`;
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
    const { artist_name, contact_name, email, phone, genre, label_affiliation, socan_membership_number, factor_eligible, notes } = body;
    if (!artist_name) return Response.json({ error: 'artist_name is required' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO rs_clients (artist_name, contact_name, email, phone, genre, label_affiliation, socan_membership_number, factor_eligible, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [artist_name, contact_name, email, phone, genre, label_affiliation, socan_membership_number, factor_eligible ?? false, notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
