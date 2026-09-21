export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS process_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_name TEXT NOT NULL,
    source_system TEXT,
    case_count INT DEFAULT 0,
    avg_duration_days NUMERIC,
    variants_count INT DEFAULT 0,
    happy_path_pct NUMERIC,
    rework_pct NUMERIC,
    last_analyzed TIMESTAMPTZ,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS process_variant (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID REFERENCES process_map(id) ON DELETE CASCADE,
    variant_name TEXT,
    frequency INT DEFAULT 0,
    avg_duration NUMERIC,
    is_happy_path BOOLEAN DEFAULT false,
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
    const items = await query(`SELECT * FROM process_map ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM process_variant ORDER BY created_at DESC LIMIT 500`);
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
      `INSERT INTO process_map (process_name, source_system, avg_duration_days, happy_path_pct, rework_pct, last_analyzed) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [body.process_name ?? null, body.source_system ?? null, body.avg_duration_days ?? null, body.happy_path_pct ?? null, body.rework_pct ?? null, body.last_analyzed ?? null]
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
    await query(`DELETE FROM process_map WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
