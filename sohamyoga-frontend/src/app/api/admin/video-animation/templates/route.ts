import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');

    let q = 'SELECT * FROM anim_motion_templates WHERE 1=1';
    const vals: unknown[] = [];
    if (category) { vals.push(category); q += ` AND category = $${vals.length}`; }
    q += ' ORDER BY usage_count DESC, created_at DESC';

    const result = await client.query(q, vals);
    return Response.json({ templates: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { name, category, duration_seconds = 30, style, tags = [] } = body;
    if (!name || !category) return Response.json({ error: 'name and category are required' }, { status: 400 });

    const result = await client.query(
      `INSERT INTO anim_motion_templates (name, category, duration_seconds, style, tags)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, category, duration_seconds, style, tags]
    );
    return Response.json({ template: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
