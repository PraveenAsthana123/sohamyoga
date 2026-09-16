import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { action, badge_number } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    let result;
    if (action === 'check_in') {
      result = await client.query(
        `UPDATE cw_visitor SET checked_in_at = NOW(), badge_number = $1 WHERE id = $2 RETURNING *`,
        [badge_number, params.id]
      );
    } else if (action === 'check_out') {
      result = await client.query(
        `UPDATE cw_visitor SET checked_out_at = NOW() WHERE id = $1 RETURNING *`,
        [params.id]
      );
    } else {
      const allowed = ['visitor_name','visitor_company','visit_purpose','scheduled_at','badge_number'];
      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (key in body) { updates.push(`${key} = $${idx++}`); values.push(body[key]); }
      }
      if (!updates.length) return Response.json({ error: 'No valid fields or action' }, { status: 400 });
      values.push(params.id);
      result = await client.query(
        `UPDATE cw_visitor SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
    }
    if (!result.rows.length) return Response.json({ error: 'Visitor not found' }, { status: 404 });
    return Response.json({ visitor: result.rows[0] });
  } finally {
    client.release();
  }
}
