export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

async function ensureTable(client: import('pg').PoolClient): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS agency_website_pages (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    section TEXT NOT NULL,
    content_blocks JSONB DEFAULT '[]',
    seo_title TEXT,
    seo_description TEXT,
    status TEXT DEFAULT 'draft',
    last_published TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS agency_website_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const section = searchParams.get('section');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { params.push(status); conditions.push(`status=$${params.length}`); }
    if (section) { params.push(section); conditions.push(`section=$${params.length}`); }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const r = await client.query(`SELECT * FROM agency_website_pages${where} ORDER BY section, title`, params);
    return Response.json({ pages: r.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const { slug, title, section, content_blocks, seo_title, seo_description } = body;
  if (!slug || !title || !section) return Response.json({ error: 'slug, title, section required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const r = await client.query(
      `INSERT INTO agency_website_pages (slug, title, section, content_blocks, seo_title, seo_description)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [slug, title, section, JSON.stringify(content_blocks || []), seo_title || null, seo_description || null]
    );
    return Response.json(r.rows[0], { status: 201 });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505') {
      return Response.json({ error: 'Slug already exists' }, { status: 409 });
    }
    throw e;
  } finally {
    client.release();
  }
}
