export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS rpa_bot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_name TEXT NOT NULL,
    process_name TEXT,
    department TEXT,
    tool TEXT DEFAULT 'UiPath',
    runs_per_day INT DEFAULT 0,
    success_rate NUMERIC DEFAULT 100,
    avg_time_saved_min NUMERIC,
    status TEXT DEFAULT 'active',
    last_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS rpa_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES rpa_bot(id) ON DELETE CASCADE,
    run_start TIMESTAMPTZ,
    run_end TIMESTAMPTZ,
    status TEXT DEFAULT 'success',
    items_processed INT DEFAULT 0,
    errors INT DEFAULT 0,
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
    const items = await query(`SELECT * FROM rpa_bot ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM rpa_log ORDER BY created_at DESC LIMIT 500`);
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
      `INSERT INTO rpa_bot (bot_name, process_name, department, avg_time_saved_min, last_run) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [body.bot_name ?? null, body.process_name ?? null, body.department ?? null, body.avg_time_saved_min ?? null, body.last_run ?? null]
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
    await query(`DELETE FROM rpa_bot WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
