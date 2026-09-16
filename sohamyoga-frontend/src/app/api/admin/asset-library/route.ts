export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS asset_library (
      id SERIAL PRIMARY KEY, title TEXT NOT NULL, asset_type TEXT NOT NULL,
      category TEXT, tags TEXT[], file_url TEXT, thumbnail_url TEXT,
      file_size_kb INT, mime_type TEXT, source TEXT DEFAULT 'upload',
      usage_count INT DEFAULT 0, status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const q = searchParams.get('q');
    let sql = 'SELECT * FROM asset_library WHERE status=$1';
    const params: unknown[] = ['active'];
    if (category) { params.push(category); sql += ` AND category=$${params.length}`; }
    if (type) { params.push(type); sql += ` AND asset_type=$${params.length}`; }
    if (q) { params.push(`%${q}%`); sql += ` AND title ILIKE $${params.length}`; }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const result = await client.query(sql, params);
    const stats = await client.query('SELECT asset_type, COUNT(*) as cnt FROM asset_library WHERE status=$1 GROUP BY asset_type', ['active']);
    return Response.json({ assets: result.rows, stats: stats.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const { title, asset_type, category, tags, file_url, thumbnail_url, file_size_kb, mime_type, source } = body;
  if (!title || !asset_type) return Response.json({ error: 'title and asset_type required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO asset_library (title, asset_type, category, tags, file_url, thumbnail_url, file_size_kb, mime_type, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, asset_type, category, tags, file_url, thumbnail_url, file_size_kb, mime_type, source ?? 'upload']
    );
    return Response.json(r.rows[0], { status: 201 });
  } finally { client.release(); }
}
