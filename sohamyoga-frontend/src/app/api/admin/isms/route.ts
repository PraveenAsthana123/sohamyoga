export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS isms_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iso_clause TEXT,
    control_name TEXT NOT NULL,
    description TEXT,
    implementation_status TEXT DEFAULT 'not-implemented',
    owner TEXT,
    evidence TEXT,
    last_reviewed DATE,
    risk_treatment TEXT DEFAULT 'mitigate',
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS isms_risk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    control_id UUID REFERENCES isms_control(id) ON DELETE CASCADE,
    asset TEXT,
    threat TEXT,
    vulnerability TEXT,
    likelihood INT DEFAULT 1,
    impact INT DEFAULT 1,
    risk_treatment TEXT DEFAULT 'mitigate',
    status TEXT DEFAULT 'open',
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
    const items = await query(`SELECT * FROM isms_control ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM isms_risk ORDER BY created_at DESC LIMIT 500`);
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
      `INSERT INTO isms_control (iso_clause, control_name, description, owner, evidence, last_reviewed) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [body.iso_clause ?? null, body.control_name ?? null, body.description ?? null, body.owner ?? null, body.evidence ?? null, body.last_reviewed ?? null]
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
    await query(`DELETE FROM isms_control WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
