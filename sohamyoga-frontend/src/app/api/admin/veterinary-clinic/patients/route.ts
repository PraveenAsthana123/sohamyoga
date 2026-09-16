import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { searchParams } = new URL(req.url);
      const owner_id = searchParams.get('owner_id');
      const species = searchParams.get('species');
      const search = searchParams.get('search');
      const conditions: string[] = [`p.status='active'`];
      const vals: unknown[] = [];
      if (owner_id) { vals.push(parseInt(owner_id)); conditions.push(`p.owner_id=$${vals.length}`); }
      if (species) { vals.push(species); conditions.push(`p.species=$${vals.length}`); }
      if (search) { vals.push(`%${search}%`); conditions.push(`(p.name ILIKE $${vals.length} OR o.first_name ILIKE $${vals.length} OR o.last_name ILIKE $${vals.length})`); }
      const { rows } = await client.query(`
        SELECT p.*, o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone,
          DATE_PART('year', AGE(p.date_of_birth)) AS age_years
        FROM vet_patient p
        LEFT JOIN vet_owner o ON o.id=p.owner_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.name
      `, vals);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { owner_id, name, species, breed, color, date_of_birth, sex, spayed_neutered = false, microchip_number, weight_kg, insurance_provider, insurance_policy, allergies, current_medications, status = 'active' } = body;
    if (!owner_id || !name || !species) return Response.json({ error: 'owner_id, name, species required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO vet_patient (owner_id, name, species, breed, color, date_of_birth, sex, spayed_neutered, microchip_number, weight_kg, insurance_provider, insurance_policy, allergies, current_medications, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
      `, [owner_id, name, species, breed, color, date_of_birth || null, sex, spayed_neutered, microchip_number, weight_kg || null, insurance_provider, insurance_policy, allergies, current_medications, status]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
