export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS drone_project (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL,
    client_name TEXT,
    location TEXT,
    flight_date DATE,
    pilot_name TEXT,
    equipment TEXT,
    footage_duration_min NUMERIC,
    edit_status TEXT DEFAULT 'raw',
    delivery_date DATE,
    amount NUMERIC,
    status TEXT DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS drone_asset (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES drone_project(id) ON DELETE CASCADE,
    file_name TEXT,
    resolution TEXT,
    duration_sec INT,
    storage_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  if (!databaseConfigured()) return Response.json({ items: [], children: [] });
  try {
    await ensureSchema();
    const items = await query(`SELECT * FROM drone_project ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM drone_asset ORDER BY created_at DESC LIMIT 500`);
    return Response.json({ items: items.rows, children: children.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  if (!databaseConfigured()) return Response.json({error: 'DB not configured'}, {status: 503});
  try {
    await ensureSchema();
    const body = await request.json() as Record<string, unknown>;
    const result = await query(
      `INSERT INTO drone_project (project_name, client_name, location, flight_date, pilot_name, equipment, footage_duration_min, delivery_date, amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [body.project_name ?? null, body.client_name ?? null, body.location ?? null, body.flight_date ?? null, body.pilot_name ?? null, body.equipment ?? null, body.footage_duration_min ?? null, body.delivery_date ?? null, body.amount ?? null]
    );
    return Response.json(result.rows[0], { status: 201 });
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  if (!databaseConfigured()) return Response.json({error: 'DB not configured'}, {status: 503});
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({error: 'id required'}, {status: 400});
    await query(`DELETE FROM drone_project WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
