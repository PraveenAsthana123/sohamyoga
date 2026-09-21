export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS abm_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    industry TEXT,
    tier TEXT DEFAULT 'tier-2',
    revenue_potential NUMERIC,
    primary_contact TEXT,
    email TEXT,
    phone TEXT,
    assigned_rep TEXT,
    engagement_score INT DEFAULT 0,
    status TEXT DEFAULT 'targeting',
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS abm_touchpoint (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES abm_account(id) ON DELETE CASCADE,
    touchpoint_type TEXT,
    channel TEXT,
    notes TEXT,
    outcome TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
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
    const items = await query(`SELECT * FROM abm_account ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM abm_touchpoint ORDER BY created_at DESC LIMIT 500`);
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
      `INSERT INTO abm_account (company_name, industry, revenue_potential, primary_contact, email, phone, assigned_rep) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.company_name ?? null, body.industry ?? null, body.revenue_potential ?? null, body.primary_contact ?? null, body.email ?? null, body.phone ?? null, body.assigned_rep ?? null]
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
    await query(`DELETE FROM abm_account WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
