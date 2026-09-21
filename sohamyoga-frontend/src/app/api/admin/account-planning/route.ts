export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS account_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name TEXT NOT NULL,
    account_tier TEXT DEFAULT 'strategic',
    industry TEXT,
    arr_current NUMERIC DEFAULT 0,
    arr_target NUMERIC,
    whitespace_opportunities TEXT[],
    key_contacts TEXT[],
    exec_sponsor TEXT,
    plan_status TEXT DEFAULT 'draft',
    review_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS account_initiative (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES account_plan(id) ON DELETE CASCADE,
    initiative_name TEXT,
    objective TEXT,
    owner TEXT,
    budget NUMERIC,
    timeline TEXT,
    status TEXT DEFAULT 'planned',
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
    const items = await query(`SELECT * FROM account_plan ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM account_initiative ORDER BY created_at DESC LIMIT 500`);
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
      `INSERT INTO account_plan (account_name, industry, arr_target, whitespace_opportunities, key_contacts, exec_sponsor, review_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.account_name ?? null, body.industry ?? null, body.arr_target ?? null, body.whitespace_opportunities ?? null, body.key_contacts ?? null, body.exec_sponsor ?? null, body.review_date ?? null]
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
    await query(`DELETE FROM account_plan WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
