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
      CREATE TABLE IF NOT EXISTS pg_pet (
        id SERIAL PRIMARY KEY, owner_id INTEGER REFERENCES pg_owner(id),
        name TEXT NOT NULL, species TEXT DEFAULT 'dog' CHECK (species IN ('dog','cat','rabbit','guinea_pig','bird','other')),
        breed TEXT, color TEXT, date_of_birth DATE, sex TEXT CHECK (sex IN ('male','female')),
        weight_kg DECIMAL(6,2), spayed_neutered BOOLEAN DEFAULT false,
        vaccination_status TEXT DEFAULT 'unknown' CHECK (vaccination_status IN ('current','expired','unknown')),
        rabies_expiry DATE, bordetella_expiry DATE, distemper_expiry DATE,
        behavioural_notes TEXT, grooming_notes TEXT, allergies TEXT,
        last_visit DATE, created_at TIMESTAMPTZ DEFAULT NOW()
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
  const owner_id = searchParams.get('owner_id');
  const vaccination_status = searchParams.get('vaccination_status');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (owner_id) { conditions.push(`p.owner_id = $${idx++}`); values.push(owner_id); }
  if (vaccination_status) { conditions.push(`p.vaccination_status = $${idx++}`); values.push(vaccination_status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT p.*, o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone
       FROM pg_pet p LEFT JOIN pg_owner o ON p.owner_id = o.id
       ${where} ORDER BY p.name LIMIT 200`,
      values
    );
    return Response.json({ pets: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json();
  const { owner_id, name, species = 'dog', breed, color, date_of_birth, sex, weight_kg, spayed_neutered = false, vaccination_status = 'unknown', rabies_expiry, bordetella_expiry, distemper_expiry, behavioural_notes, grooming_notes, allergies } = body;
  if (!owner_id || !name) return Response.json({ error: 'owner_id and name required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO pg_pet (owner_id, name, species, breed, color, date_of_birth, sex, weight_kg, spayed_neutered, vaccination_status, rabies_expiry, bordetella_expiry, distemper_expiry, behavioural_notes, grooming_notes, allergies)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [owner_id, name, species, breed, color, date_of_birth, sex, weight_kg, spayed_neutered, vaccination_status, rabies_expiry, bordetella_expiry, distemper_expiry, behavioural_notes, grooming_notes, allergies]
    );
    return Response.json({ pet: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
