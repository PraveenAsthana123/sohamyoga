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
    const r = await client.query('SELECT * FROM agency_website_pages WHERE slug=$1', [slug]);
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
  const { title, section, content_blocks, seo_title, seo_description, status } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (title !== undefined) { vals.push(title); sets.push(`title=$${vals.length}`); }
    if (section !== undefined) { vals.push(section); sets.push(`section=$${vals.length}`); }
    if (content_blocks !== undefined) { vals.push(JSON.stringify(content_blocks)); sets.push(`content_blocks=$${vals.length}`); }
    if (seo_title !== undefined) { vals.push(seo_title); sets.push(`seo_title=$${vals.length}`); }
    if (seo_description !== undefined) { vals.push(seo_description); sets.push(`seo_description=$${vals.length}`); }
    if (status !== undefined) { vals.push(status); sets.push(`status=$${vals.length}`); }
    if (sets.length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(slug);
    const r = await client.query(
      `UPDATE agency_website_pages SET ${sets.join(',')} WHERE slug=$${vals.length} RETURNING *`, vals
    );
    if (r.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(r.rows[0]);
  } finally {
    client.release();
  }
}
