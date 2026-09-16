import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Toggle featured or update other fields
    const { is_featured } = body;
    if (is_featured !== undefined) {
      const result = await client.query(
        `UPDATE el_review SET is_featured = $1 WHERE id = $2 RETURNING *`,
        [is_featured, params.id]
      );
      if (!result.rows.length) return Response.json({ error: 'Review not found' }, { status: 404 });
      return Response.json({ review: result.rows[0] });
    }
    const allowed = ['rating','review_text'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const key of allowed) {
      if (key in body) { updates.push(`${key} = $${idx++}`); values.push(body[key]); }
    }
    if (!updates.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
    values.push(params.id);
    const result = await client.query(
      `UPDATE el_review SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) return Response.json({ error: 'Review not found' }, { status: 404 });
    return Response.json({ review: result.rows[0] });
  } finally {
    client.release();
  }
}
