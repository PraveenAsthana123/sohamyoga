export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS video_asset (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    format TEXT,
    duration TEXT,
    channels TEXT[],
    views_total INT DEFAULT 0,
    status TEXT DEFAULT 'ready',
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS distribution_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES video_asset(id) ON DELETE CASCADE,
    channel TEXT,
    publish_url TEXT,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    views INT DEFAULT 0,
    status TEXT DEFAULT 'scheduled',
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
    const items = await query(`SELECT * FROM video_asset ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM distribution_job ORDER BY created_at DESC LIMIT 500`);
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
      `INSERT INTO video_asset (title, format, duration, channels) VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.title ?? null, body.format ?? null, body.duration ?? null, body.channels ?? null]
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
    await query(`DELETE FROM video_asset WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
