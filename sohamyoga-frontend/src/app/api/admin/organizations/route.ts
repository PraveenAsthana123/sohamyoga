import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS organization (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    type TEXT DEFAULT 'client',
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    domain TEXT,
    industry TEXT,
    employee_count TEXT,
    billing_email TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const { rows } = await pool.query(`SELECT * FROM organization ORDER BY created_at DESC LIMIT 500`);
  return Response.json({ organizations: rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const b = await req.json().catch(() => null);
  if (!b?.name) return Response.json({ error: 'name is required' }, { status: 400 });
  const { rows } = await pool.query(
    `INSERT INTO organization (name, slug, type, plan, status, domain, industry, employee_count, billing_email, contact_name, contact_phone, logo_url, settings)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [b.name, b.slug || null, b.type || 'client', b.plan || 'free', b.status || 'active',
     b.domain || null, b.industry || null, b.employee_count || null, b.billing_email || null,
     b.contact_name || null, b.contact_phone || null, b.logo_url || null, JSON.stringify(b.settings || {})]
  );
  return Response.json({ organization: rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const b = await req.json().catch(() => null);
  if (!b?.id) return Response.json({ error: 'id is required' }, { status: 400 });
  const fields = ['name','slug','type','plan','status','domain','industry','employee_count',
    'billing_email','contact_name','contact_phone','logo_url','settings'];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const f of fields) {
    if (f in b) {
      setClauses.push(`${f} = $${idx++}`);
      values.push(f === 'settings' ? JSON.stringify(b[f]) : b[f]);
    }
  }
  if (!setClauses.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
  values.push(b.id);
  const { rows } = await pool.query(
    `UPDATE organization SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ organization: rows[0] });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
  await pool.query(`DELETE FROM organization WHERE id = $1`, [id]);
  return Response.json({ ok: true });
}
