export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });

  const client = await pool.connect();
  try {
    const body = await req.json() as {
      author_name?: string;
      author_role?: string;
      author_company?: string;
      content?: string;
      rating?: number;
      is_featured?: boolean;
      is_active?: boolean;
      sort_order?: number;
    };
    const { author_name, author_role, author_company, content, rating, is_featured, is_active, sort_order } = body;

    const { rows } = await client.query(
      `UPDATE testimonial
       SET author_name    = COALESCE($1, author_name),
           author_role    = COALESCE($2, author_role),
           author_company = COALESCE($3, author_company),
           content        = COALESCE($4, content),
           rating         = COALESCE($5, rating),
           is_featured    = COALESCE($6, is_featured),
           is_active      = COALESCE($7, is_active),
           sort_order     = COALESCE($8, sort_order),
           updated_at     = NOW()
       WHERE id = $9
       RETURNING *`,
      [author_name, author_role, author_company, content, rating, is_featured, is_active, sort_order, id]
    );
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });

  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      `DELETE FROM testimonial WHERE id = $1`,
      [id]
    );
    if (!rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
