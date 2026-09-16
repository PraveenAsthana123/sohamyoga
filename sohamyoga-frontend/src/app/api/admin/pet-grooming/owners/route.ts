import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pg_owner (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT NOT NULL, address TEXT,
        emergency_contact_name TEXT, emergency_contact_phone TEXT,
        vet_name TEXT, vet_phone TEXT, vet_clinic TEXT,
        notes TEXT, total_visits INTEGER DEFAULT 0, total_spent DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const pool = getPool();
  const client = await pool.connect();
  try {
    let result;
    if (search) {
      result = await client.query(
        `SELECT o.*, COUNT(p.id) AS pet_count
         FROM pg_owner o LEFT JOIN pg_pet p ON p.owner_id = o.id
         WHERE o.first_name ILIKE $1 OR o.last_name ILIKE $1 OR o.email ILIKE $1 OR o.phone ILIKE $1
         GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100`,
        [`%${search}%`]
      );
    } else {
      result = await client.query(
        `SELECT o.*, COUNT(p.id) AS pet_count
         FROM pg_owner o LEFT JOIN pg_pet p ON p.owner_id = o.id
         GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`
      );
    }
    return Response.json({ owners: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json();
  const { first_name, last_name, phone, email, address, emergency_contact_name, emergency_contact_phone, vet_name, vet_phone, vet_clinic, notes } = body;
  if (!first_name || !last_name || !phone) return Response.json({ error: 'first_name, last_name, phone required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO pg_owner (first_name, last_name, phone, email, address, emergency_contact_name, emergency_contact_phone, vet_name, vet_phone, vet_clinic, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [first_name, last_name, phone, email, address, emergency_contact_name, emergency_contact_phone, vet_name, vet_phone, vet_clinic, notes]
    );
    return Response.json({ owner: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
