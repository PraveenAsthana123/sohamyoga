import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const result = await pool.query(`SELECT * FROM blog_post WHERE id = $1`, [id]);
    if (result.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ post: result.rows[0] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'No body' }, { status: 400 });

  const allowed = [
    'title', 'slug', 'excerpt', 'content', 'category', 'tags', 'status',
    'seo_title', 'seo_description', 'seo_keywords', 'word_count', 'reading_time_minutes',
    'scheduled_at', 'published_at', 'featured_image_url', 'ai_generated',
  ];
  const fields = Object.keys(body).filter(k => allowed.includes(k));
  if (fields.length === 0) return Response.json({ error: 'No valid fields' }, { status: 400 });

  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  try {
    const result = await pool.query(
      `UPDATE blog_post SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...fields.map(f => body[f])],
    );
    if (result.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ post: result.rows[0] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const result = await pool.query(`DELETE FROM blog_post WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ deleted: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
