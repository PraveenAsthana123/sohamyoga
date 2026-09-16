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
      name?: string;
      role?: string;
      bio?: string;
      image_url?: string;
      email?: string;
      linkedin_url?: string;
      sort_order?: number;
      is_active?: boolean;
    };
    const { name, role, bio, image_url, email, linkedin_url, sort_order, is_active } = body;

    const { rows } = await client.query(
      `UPDATE team_member
       SET name         = COALESCE($1, name),
           role         = COALESCE($2, role),
           bio          = COALESCE($3, bio),
           image_url    = COALESCE($4, image_url),
           email        = COALESCE($5, email),
           linkedin_url = COALESCE($6, linkedin_url),
           sort_order   = COALESCE($7, sort_order),
           is_active    = COALESCE($8, is_active),
           updated_at   = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, role, bio, image_url, email, linkedin_url, sort_order, is_active, id]
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
      `DELETE FROM team_member WHERE id = $1`,
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
