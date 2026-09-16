export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { slug } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM academy_courses WHERE slug=$1', [slug]);
    if (r.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(r.rows[0]);
  } finally {
    client.release();
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const fields = ['title', 'category', 'description', 'duration_hours', 'level', 'instructor', 'status'];
  const pool = getPool();
  const client = await pool.connect();
  try {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (body[f] !== undefined) { vals.push(body[f]); sets.push(`${f}=$${vals.length}`); }
    }
    if (body.modules !== undefined) { vals.push(JSON.stringify(body.modules)); sets.push(`modules=$${vals.length}`); }
    if (sets.length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(slug);
    const r = await client.query(`UPDATE academy_courses SET ${sets.join(',')} WHERE slug=$${vals.length} RETURNING *`, vals);
    if (r.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(r.rows[0]);
  } finally {
    client.release();
  }
}
